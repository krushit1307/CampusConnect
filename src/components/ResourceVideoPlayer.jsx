import React from 'react';
import PropTypes from 'prop-types';

export default function ResourceVideoPlayer({ videoUrl, vttTrackUrl, title }) {
  return (
    <div className="video-player-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <h3>{title}</h3>
      <video controls width="100%" style={{ borderRadius: '8px', background: '#000' }}>
        <source src={videoUrl} type="video/mp4" />
        {vttTrackUrl && (
          <track
            src={vttTrackUrl}
            kind="subtitles"
            srclang="en"
            label="English Closed Captions"
            default
          />
        )}
        Your browser does not support the video tag.
      </video>
    </div>
  );
}

ResourceVideoPlayer.propTypes = {
  videoUrl: PropTypes.string.isRequired,
  vttTrackUrl: PropTypes.string,
  title: PropTypes.string.isRequired,
};
