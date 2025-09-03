import { useState, useEffect } from 'preact/hooks';
import type { FunctionComponent } from 'preact';
import { BackendClient } from '../../backend/client';
import type { WikilinkCandidatesResponse, WikilinkCandidate } from '../../backend/types';
import './WikilinkCandidatesView.css';
import { log } from '../../diag';

interface WikilinkCandidatesViewProps {
  backendClient: BackendClient;
  onRefresh: () => void;
}

// Configuration interface for the candidates view
interface CandidateViewConfig {
  defaultPageSize: number;
  showContext: boolean;
  maxContextLength: number;
  includeSpans: boolean;
}

export const WikilinkCandidatesView: FunctionComponent<WikilinkCandidatesViewProps> = ({ backendClient, onRefresh }) => {
  const [candidates, setCandidates] = useState<WikilinkCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCandidates, setTotalCandidates] = useState(0);
  
  // Configuration state
  const [config, setConfig] = useState<CandidateViewConfig>({
    defaultPageSize: 20,
    showContext: true,
    maxContextLength: 60,
    includeSpans: true
  });

  // Generate stable keys for candidates to avoid React rendering issues
  const getStableKey = (candidate: WikilinkCandidate): string => {
    const firstFile = candidate.files?.[0] || '';
    const firstSpan = candidate.spansByFile?.[firstFile]?.[0];
    const spanStart = firstSpan?.start || 0;
    return `${candidate.text}|${firstFile}|${spanStart}`;
  };

  const fetchCandidates = async (page: number = 1) => {
    setLoading(true);
    setError(null);
    try {
      log.debug("WikilinkCandidatesView: fetching candidates", { page, pageSize });
      const t = `fetch candidates p${page}`;
      log.time(t);
      
      const response = await backendClient.getWikilinkCandidates({
        page,
        page_size: pageSize
      });
      
      log.debug("candidates loaded", { count: response.candidates?.length, total: response.total_candidates });
      log.timeEnd(t);
      
      setCandidates(response.candidates);
      setTotalPages(response.total_pages);
      setTotalCandidates(response.total_candidates);
      setCurrentPage(page);
    } catch (err) {
      log.error("candidates error", err);
      setError(err instanceof Error ? err.message : 'Failed to fetch candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    log.debug("WikilinkCandidatesView: initial fetch on mount");
    fetchCandidates(1);
  }, []);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && currentPage > 1) {
        handlePageChange(currentPage - 1);
      } else if (event.key === 'ArrowRight' && currentPage < totalPages) {
        handlePageChange(currentPage + 1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

  const handlePageChange = (page: number) => {
    fetchCandidates(page);
  };

  const handleRefresh = () => {
    fetchCandidates(currentPage);
    onRefresh();
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setConfig(prev => ({ ...prev, defaultPageSize: newPageSize }));
    fetchCandidates(1); // Reset to first page when changing page size
  };

  if (loading && candidates.length === 0) {
    return <div className="candidates-loading">Loading candidates...</div>;
  }

  if (error) {
    return (
      <div className="candidates-error">
        <p>Error: {error}</p>
        <button type="button" onClick={() => fetchCandidates(1)}>Retry</button>
      </div>
    );
  }

  return (
    <div className="candidates-content">
      <div className="candidates-header">
        <h3>Wikilink Candidates ({totalCandidates} total)</h3>
        <div className="candidates-controls">
          <div className="candidates-config">
            <label className="config-item">
              <span>Page Size:</span>
              <select 
                value={pageSize} 
                onChange={(e) => handlePageSizeChange(Number(e.currentTarget.value))}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            <label className="config-item">
              <input 
                type="checkbox" 
                checked={config.showContext} 
                onChange={(e) => setConfig(prev => ({ ...prev, showContext: e.currentTarget.checked }))}
              />
              <span>Show Context</span>
            </label>
            <label className="config-item">
              <input 
                type="checkbox" 
                checked={config.includeSpans} 
                onChange={(e) => setConfig(prev => ({ ...prev, includeSpans: e.currentTarget.checked }))}
              />
              <span>Include Spans</span>
            </label>
          </div>
          <div className="candidates-stats">
            Page {currentPage} of {totalPages}
          </div>
          <button type="button" onClick={handleRefresh} className="refresh-button">
            Refresh
          </button>
        </div>
      </div>
      
      <div className="candidates-list">
        {candidates.map((candidate) => (
          <div key={getStableKey(candidate)} className="candidate-item">
            <div className="candidate-main">
              <span className="candidate-text">{candidate.text}</span>
              <div className="candidate-meta">
                <span className="candidate-score">Score: {candidate.score.toFixed(3)}</span>
                <span className="candidate-count">Count: {candidate.count}</span>
                <span className="candidate-total">Total: {candidate.total}</span>
              </div>
            </div>
            {candidate.fuzzy_resolution && (
              <div className="candidate-fuzzy">
                Resolves to: {candidate.fuzzy_resolution}
              </div>
            )}
            {candidate.files && candidate.files.length > 0 && (
              <div className="candidate-files">
                <span>Appears in {candidate.files.length} file{candidate.files.length !== 1 ? 's' : ''}:</span>
                <div className="file-list">
                  {candidate.files.slice(0, 3).map((file: string, fileIndex: number) => (
                    <span key={`${getStableKey(candidate)}-file-${fileIndex}`} className="file-item">{file}</span>
                  ))}
                  {candidate.files.length > 3 && (
                    <span className="file-more">...and {candidate.files.length - 3} more</span>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      
      {totalPages > 1 && (
        <div className="candidates-pagination">
                  <button 
          type="button"
          disabled={currentPage === 1}
          onClick={() => handlePageChange(currentPage - 1)}
        >
          Previous
        </button>
          <span className="page-info">
            {currentPage} / {totalPages}
          </span>
                  <button 
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
        >
          Next
        </button>
        </div>
      )}
      
      <div className="candidates-help">
        <p><strong>Keyboard Navigation:</strong> Use ← → arrow keys to navigate between pages</p>
      </div>
    </div>
  );
};
