import React, { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Chip,
  CircularProgress,
  Box,
  IconButton,
  Tooltip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { webhookService, WebhookDelivery, Webhook } from "../../services/webhookService";

interface DeliveryHistoryProps {
  webhook: Webhook;
}

export const DeliveryHistory: React.FC<DeliveryHistoryProps> = ({ webhook }) => {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const data = await webhookService.getDeliveries(webhook.id);
      setDeliveries(data);
      setError("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [webhook.id]);

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Typography color="error">{error}</Typography>;
  }

  if (deliveries.length === 0) {
    return <Typography>No delivery history found for this webhook.</Typography>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "success";
      case "failed":
        return "warning";
      case "permanent_failure":
        return "error";
      default:
        return "default";
    }
  };

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2, alignItems: "center" }}>
        <Typography variant="h6">Delivery History</Typography>
        <IconButton onClick={fetchHistory} title="Refresh History">
          <RefreshIcon />
        </IconButton>
      </Box>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Event</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Status Code</TableCell>
              <TableCell>Attempt</TableCell>
              <TableCell>Error</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {deliveries.map((delivery) => (
              <TableRow key={delivery.id}>
                <TableCell>{new Date(delivery.created_at).toLocaleString()}</TableCell>
                <TableCell>{delivery.event_name}</TableCell>
                <TableCell>
                  <Chip
                    label={delivery.status}
                    size="small"
                    color={getStatusColor(delivery.status)}
                  />
                </TableCell>
                <TableCell>{delivery.status_code || "-"}</TableCell>
                <TableCell>{delivery.attempt}</TableCell>
                <TableCell>
                  {delivery.last_error ? (
                    <Tooltip title={delivery.response_body || "No response body"}>
                      <Typography
                        variant="body2"
                        color="error"
                        sx={{
                          cursor: "help",
                          maxWidth: 200,
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {delivery.last_error}
                      </Typography>
                    </Tooltip>
                  ) : (
                    "-"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};
