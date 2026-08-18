-- Add linked partitions (array of UUIDs of other venue spaces) and maximum physical capacity
ALTER TABLE venues 
ADD COLUMN linked_partitions UUID[] DEFAULT '{}',
ADD COLUMN max_combined_capacity INT NOT NULL DEFAULT 0;
