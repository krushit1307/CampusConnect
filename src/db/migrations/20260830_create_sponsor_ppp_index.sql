-- Create Sponsor PPP Index Table
CREATE TABLE IF NOT EXISTS sponsor_ppp_index (
  id SERIAL PRIMARY KEY,
  country_code VARCHAR(2) NOT NULL UNIQUE,
  country_name VARCHAR(100) NOT NULL,
  ppp_index DECIMAL(4, 2) NOT NULL DEFAULT 1.0,
  base_currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  effective_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert PPP Index Data (IMF/World Bank standard: USA = 1.0)
INSERT INTO sponsor_ppp_index (country_code, country_name, ppp_index, notes) VALUES
  ('US', 'United States', 1.0, 'Base index'),
  ('IN', 'India', 0.30, 'Lower purchasing power'),
  ('BR', 'Brazil', 0.50, 'Moderate purchasing power'),
  ('DE', 'Germany', 0.92, 'High-income economy'),
  ('FR', 'France', 0.91, 'High-income economy'),
  ('GB', 'United Kingdom', 0.88, 'High-income economy'),
  ('CA', 'Canada', 0.95, 'High-income economy'),
  ('AU', 'Australia', 0.96, 'High-income economy'),
  ('JP', 'Japan', 0.87, 'High-income economy'),
  ('CH', 'Switzerland', 1.08, 'Highest purchasing power'),
  ('SG', 'Singapore', 0.94, 'High-income economy'),
  ('CN', 'China', 0.35, 'Emerging market'),
  ('MX', 'Mexico', 0.45, 'Emerging market');

CREATE INDEX idx_ppp_country_code ON sponsor_ppp_index(country_code);
CREATE INDEX idx_ppp_active ON sponsor_ppp_index(active);