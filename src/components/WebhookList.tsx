import React from "react";
import { Card, CardContent, Typography, Switch, IconButton, Box, Chip } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import { Webhook } from "../../services/webhookService";

interface WebhookListProps {
  webhooks: Webhook[];
  onToggleActive: (id: string, active: boolean) => void;
  onEdit: (webhook: Webhook) => void;
  onDelete: (id: string) => void;
  onViewHistory: (webhook: Webhook) => void;
}

export const WebhookList: React.FC<WebhookListProps> = ({
  webhooks,
  onToggleActive,
  onEdit,
  onDelete,
  onViewHistory,
}) => {
  if (webhooks.length === 0) {
    return <Typography color="textSecondary">No webhooks configured yet.</Typography>;
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {webhooks.map((webhook) => (
        <Card key={webhook.id} variant="outlined">
          <CardContent
            sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <Box>
              <Typography variant="h6">{webhook.url}</Typography>
              <Box sx={{ mt: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                {webhook.events_subscribed.map((evt) => (
                  <Chip key={evt} label={evt} size="small" />
                ))}
              </Box>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Switch
                checked={webhook.is_active}
                onChange={(e) => onToggleActive(webhook.id, e.target.checked)}
                color="primary"
              />
              <IconButton onClick={() => onViewHistory(webhook)} title="View Delivery History">
                <HistoryIcon />
              </IconButton>
              <IconButton onClick={() => onEdit(webhook)} title="Edit Webhook">
                <EditIcon />
              </IconButton>
              <IconButton onClick={() => onDelete(webhook.id)} color="error" title="Delete Webhook">
                <DeleteIcon />
              </IconButton>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
};
