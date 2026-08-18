import React, { useState } from 'react';
import PropTypes from 'prop-types';

export default function ResumeRedactionReview({ previewUrl, onConfirm, onEdit }) {
  const [isConfirmed, setIsConfirmed] = useState(false);

  return (
    <div className="redaction-review-container" style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h3>Review Redacted Resume</h3>
      <p style={{ color: '#555', marginBottom: '1rem' }}>
        To comply with hiring regulations, automated filters have blacked out detected PII (such as exact addresses or ID numbers). Please review the preview below before final submission to sponsors.
      </p>

      <div className="pdf-preview-frame" style={{ border: '1px solid #ccc', height: '500px', marginBottom: '1.5rem' }}>
        <iframe
          src={`${previewUrl}#toolbar=0`}
          title="Redacted Resume Preview"
          width="100%"
          height="100%"
          style={{ border: 'none' }}
        />
      </div>

      <div className="review-actions" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isConfirmed}
            onChange={(e) => setIsConfirmed(e.target.checked)}
          />
          <span>This is what sponsors will see. Looks good?</span>
        </label>

        <button
          type="button"
          disabled={!isConfirmed}
          onClick={onConfirm}
          className="btn-primary"
          style={{ marginLeft: 'auto', padding: '0.5rem 1.5rem' }}
        >
          Confirm & Submit to Sponsors
        </button>
      </div>
    </div>
  );
}

ResumeRedactionReview.propTypes = {
  previewUrl: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
};
