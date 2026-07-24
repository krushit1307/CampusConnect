import json
import numpy as np

# Simulate historical club turnout data for linear regression training
# Features:
# 1. Normalized RSVP count (rsvp / 100)
# 2. Historical turnout ratio of the club (0.0 to 1.0)
# 3. Weather score (0.0 = stormy/rainy, 1.0 = clear/sunny)
# Output:
# Target actual turnout ratio (0.0 to 1.0)

np.random.seed(42)
num_samples = 1000

# Generate synthetic features
rsvp_counts = np.random.randint(5, 200, num_samples)
norm_rsvps = np.minimum(rsvp_counts / 100.0, 1.0)
historical_ratios = np.random.uniform(0.5, 0.95, num_samples)
weather_scores = np.random.choice([0.2, 0.5, 0.8, 1.0], num_samples, p=[0.1, 0.2, 0.4, 0.3])

# True relationship with noise
# Turnout ratio drops slightly as RSVP size saturates (-0.05), heavily correlates with historical turnout (0.75),
# and increases with sunny weather (0.15). Base turnout coefficient is 0.10.
noise = np.random.normal(0, 0.02, num_samples)
actual_turnouts = -0.05 * norm_rsvps + 0.75 * historical_ratios + 0.15 * weather_scores + 0.10 + noise
actual_turnouts = np.clip(actual_turnouts, 0.1, 1.0)

# Build features matrix
X = np.stack([norm_rsvps, historical_ratios, weather_scores], axis=1)
y = actual_turnouts

# Ordinary Least Squares (OLS) Linear Regression formula: Beta = (X^T * X)^-1 * X^T * y
# Add bias column
X_bias = np.hstack([X, np.ones((num_samples, 1))])
beta = np.linalg.inv(X_bias.T @ X_bias) @ X_bias.T @ y

weights = beta[:3]
bias = beta[3]

print("=== Trained RSVP Turnout Prediction Model ===")
print(f"RSVP saturation weight: {weights[0]:.4f}")
print(f"Historical club turnout weight: {weights[1]:.4f}")
print(f"Weather index weight: {weights[2]:.4f}")
print(f"Bias intercept: {bias:.4f}")

# Export weights configuration to JSON
config = {
    "model_name": "rsvp_turnout_regression",
    "version": "1.0.0",
    "features": ["normalized_rsvp", "historical_ratio", "weather_score"],
    "weights": weights.tolist(),
    "bias": float(bias)
}

output_path = "public/model/turnout_model_config.json"
with open(output_path, "w") as f:
    json.dump(config, f, indent=2)

print(f"\nModel parameters exported to: {output_path}")
