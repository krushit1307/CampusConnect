ALTER TABLE events
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;

ALTER TABLE events
ADD CONSTRAINT events_latitude_valid
CHECK (
    latitude IS NULL OR
    (latitude >= -90 AND latitude <= 90)
);

ALTER TABLE events
ADD CONSTRAINT events_longitude_valid
CHECK (
    longitude IS NULL OR
    (longitude >= -180 AND longitude <= 180)
);