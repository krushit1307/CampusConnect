import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { createClient } from '@supabase/supabase-js';

// Initialize your supabase client configuration appropriately
const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, process.env.REACT_APP_SUPABASE_ANON_KEY);

export default function SmartImage({ src, alt, className, ...props }) {
  const [resolvedAlt, setResolvedAlt] = useState(alt || "Loading image description...");

  useEffect(() => {
    // If manual alt text is provided, use it directly
    if (alt) {
      setResolvedAlt(alt);
      return;
    }

    let isMounted = true;

    async function fetchAiAltText() {
      try {
        const { data, error } = await supabase
          .from('images_metadata')
          .select('generated_alt_text')
          .eq('image_url', src)
          .single();

        if (!error && data && isMounted) {
          setResolvedAlt(data.generated_alt_text);
        } else if (isMounted) {
          setResolvedAlt("Event photograph");
        }
      } catch (err) {
        if (isMounted) {
          setResolvedAlt("Event photograph");
        }
      }
    }

    fetchAiAltText();

    return () => {
      isMounted = false;
    };
  }, [src, alt]);

  return (
    <img
      src={src}
      alt={resolvedAlt}
      className={className}
      {...props}
    />
  );
}

SmartImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string,
  className: PropTypes.string,
};
