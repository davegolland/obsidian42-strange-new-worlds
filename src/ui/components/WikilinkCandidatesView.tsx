import type { FunctionComponent } from "preact";

interface WikilinkCandidatesViewProps {
	backendClient: any;
	onRefresh: () => void;
}

export const WikilinkCandidatesView: FunctionComponent<WikilinkCandidatesViewProps> = ({ backendClient, onRefresh }) => {
	return (
		<div className="snw-wikilink-candidates">
			<div className="candidates-header">
				<h3>Wikilink Candidates</h3>
				<button onClick={onRefresh} className="refresh-button">
					Refresh
				</button>
			</div>
			<div className="candidates-content">
				<p>Wikilink candidates view will be implemented here.</p>
				<p>Backend client available: {backendClient ? 'Yes' : 'No'}</p>
			</div>
		</div>
	);
};
