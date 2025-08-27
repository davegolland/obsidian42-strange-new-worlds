import React, { useState, useEffect } from 'react';
import type { WikilinkCandidate, WikilinkCandidatesResponse } from '../../backend/types';

interface WikilinkCandidatesViewProps {
  backendClient: any; // BackendClient type
  onRefresh?: () => void;
}

export const WikilinkCandidatesView: React.FC<WikilinkCandidatesViewProps> = ({ 
  backendClient, 
  onRefresh 
}) => {
  const [candidates, setCandidates] = useState<WikilinkCandidatesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await backendClient.getWikilinkCandidates();
      setCandidates(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch candidates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleRefresh = () => {
    fetchCandidates();
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className="wikilink-candidates-view">
        <div className="candidates-header">
          <h3>Wikilink Candidates</h3>
          <button onClick={handleRefresh} disabled>Loading...</button>
        </div>
        <div className="candidates-loading">Loading candidates...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="wikilink-candidates-view">
        <div className="candidates-header">
          <h3>Wikilink Candidates</h3>
          <button onClick={handleRefresh}>Retry</button>
        </div>
        <div className="candidates-error">Error: {error}</div>
      </div>
    );
  }

  if (!candidates) {
    return (
      <div className="wikilink-candidates-view">
        <div className="candidates-header">
          <h3>Wikilink Candidates</h3>
          <button onClick={handleRefresh}>Refresh</button>
        </div>
        <div className="candidates-empty">No candidates available</div>
      </div>
    );
  }

  return (
    <div className="wikilink-candidates-view">
      <div className="candidates-header">
        <h3>Wikilink Candidates</h3>
        <button onClick={handleRefresh}>Refresh</button>
      </div>
      
      <div className="candidates-summary">
        <div className="summary-item">
          <span className="summary-label">Total Candidates:</span>
          <span className="summary-value">{candidates.total_candidates}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Fuzzy Resolved:</span>
          <span className="summary-value">{candidates.fuzzy_resolved}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Resolution Rate:</span>
          <span className="summary-value">{(candidates.resolution_rate * 100).toFixed(1)}%</span>
        </div>
      </div>

      {candidates.candidates.length === 0 ? (
        <div className="candidates-empty">No wikilink candidates detected</div>
      ) : (
        <div className="candidates-list">
          {candidates.candidates.map((candidate, index) => (
            <div key={index} className="candidate-item">
              <div className="candidate-header">
                <span className="candidate-text">[[{candidate.text}]]</span>
                <span className="candidate-score">Score: {candidate.score.toFixed(3)}</span>
              </div>
              <div className="candidate-details">
                <span className="candidate-count">Count: {candidate.count}/{candidate.total}</span>
                {candidate.fuzzy_resolution && (
                  <span className="candidate-resolution">
                    → Resolved to: [[{candidate.fuzzy_resolution}]]
                  </span>
                )}
                {!candidate.fuzzy_resolution && (
                  <span className="candidate-no-resolution">→ No fuzzy resolution found</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
