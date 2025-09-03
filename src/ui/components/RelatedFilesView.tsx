import type { FunctionComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { BackendClient } from '../../backend/client';
import type { LinkCandidate, Span } from '../../backend/types';
import { buildContext } from '../lib/context';
import './RelatedFilesView.css';
import { log } from '../../diag';

interface RelatedFilesViewProps {
  backendClient: BackendClient;
  currentFilePath: string;
  onRefresh: () => void;
}

export const RelatedFilesView: FunctionComponent<RelatedFilesViewProps> = ({ 
  backendClient, 
  currentFilePath, 
  onRefresh 
}) => {
  const [relatedFiles, setRelatedFiles] = useState<LinkCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [includeSpans, setIncludeSpans] = useState(true);
  const [fileTexts, setFileTexts] = useState<Record<string, string>>({});

  const fetchRelatedFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      log.debug("RelatedFilesView: fetching related files", { file: currentFilePath, includeSpans });
      const t = `fetch related ${currentFilePath}`;
      log.time(t);
      
      const response = await backendClient.related(currentFilePath, 10, includeSpans);
      log.debug("related files loaded", { count: response.items?.length });
      log.timeEnd(t);
      
      setRelatedFiles(response.items);
      
      // Pre-fetch file contents for context previews if spans are enabled
      if (includeSpans && response.items.length > 0) {
        const texts: Record<string, string> = {};
        for (const file of response.items) {
          try {
            // Use Obsidian API to read file content
            const app = (window as any).app;
            if (app?.vault) {
              const abstractFile = app.vault.getAbstractFileByPath(file.path);
              if (abstractFile && abstractFile instanceof (window as any).TFile) {
                const content = await app.vault.read(abstractFile);
                texts[file.path] = content;
              }
            }
          } catch (err) {
            console.warn(`Failed to read file ${file.path}:`, err);
          }
        }
        setFileTexts(texts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch related files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentFilePath) {
      log.debug("RelatedFilesView: currentFilePath changed, fetching related files", { file: currentFilePath });
      fetchRelatedFiles();
    }
  }, [currentFilePath, includeSpans]);

  const getFileText = (filePath: string): string | undefined => {
    return fileTexts[filePath];
  };

  const copySpanInfo = async (filePath: string, span: Span) => {
    try {
      const spanInfo = {
        file: filePath,
        start: span.start,
        end: span.end,
        unit: span.unit || 'char'
      };
      await navigator.clipboard.writeText(JSON.stringify(spanInfo, null, 2));
      // Could add a toast notification here
    } catch (err) {
      console.error('Failed to copy span info:', err);
    }
  };

  const renderSpan = (span: Span, filePath: string) => {
    log.debug("SpanRow: render", { file: filePath, start: span.start, end: span.end });
    const text = getFileText(filePath);
    const ctx = text ? buildContext(text, span) : { before: "", match: "(span)", after: "" };

    return (
      <div key={`${filePath}-${span.start}`} className="span-item">
        <div className="span-header">
          <span className="span-file">{filePath}</span>
          <span className="span-loc">chars {span.start}–{span.end}</span>
          <button 
            type="button"
            className="span-copy" 
            onClick={() => copySpanInfo(filePath, span)}
            title="Copy span JSON"
          >
            Copy
          </button>
        </div>
        <div className="span-context">
          <span className="context-before">{ctx.before}</span>
          <mark className="candidate-highlight">{ctx.match}</mark>
          <span className="context-after">{ctx.after}</span>
        </div>
      </div>
    );
  };

  if (loading && relatedFiles.length === 0) {
    return <div className="related-loading">Loading related files...</div>;
  }

  if (error) {
    return (
      <div className="related-error">
        <p>Error: {error}</p>
        <button type="button" onClick={() => fetchRelatedFiles()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="related-content">
      <div className="related-header">
        <h3>Related Files</h3>
        <div className="related-controls">
          <label className="spans-toggle">
            <input 
              type="checkbox" 
              checked={includeSpans} 
              onChange={(e) => setIncludeSpans(e.currentTarget.checked)}
            />
            Show inferred wikilink spans (visual-only)
          </label>
          <button type="button" onClick={() => fetchRelatedFiles()} className="refresh-button">
            Refresh
          </button>
        </div>
      </div>
      
      <div className="related-list">
        {relatedFiles.length === 0 ? (
          <div className="no-related">No related files found</div>
        ) : (
          relatedFiles.map((file, index) => (
            <div key={`${file.path}-${index}`} className="related-file-item">
              <div className="file-main">
                <span className="file-path">{file.path}</span>
                <div className="file-meta">
                  {file.score && (
                    <span className="file-score">Score: {file.score.toFixed(3)}</span>
                  )}
                  {file.reason && (
                    <span className="file-reason">{file.reason}</span>
                  )}
                </div>
              </div>
              {file.span && includeSpans && renderSpan(file.span, file.path)}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
