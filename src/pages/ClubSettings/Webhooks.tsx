import React, { useEffect, useState } from "react";
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import { WebhookList } from "../../components/WebhookList";
import { WebhookForm } from "../../components/WebhookForm";
import { DeliveryHistory } from "../../components/DeliveryHistory";
import { webhookService, Webhook } from "../../services/webhookService";

interface WebhooksSettingsProps {
  clubId: string;
}

export const WebhooksSettings: React.FC<WebhooksSettingsProps> = ({ clubId }) => {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | undefined>();
  const [viewHistoryWebhook, setViewHistoryWebhook] = useState<Webhook | undefined>();

  const loadWebhooks = async () => {
    try {
      const data = await webhookService.getWebhooks(clubId);
      setWebhooks(data);
    } catch (error) {
      console.error("Error loading webhooks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWebhooks();
  }, [clubId]);

  const handleCreateOrUpdate = async (data: Omit<Webhook, "id" | "created_at">) => {
    try {
      if (editingWebhook) {
        await webhookService.updateWebhook(editingWebhook.id, data);
      } else {
        await webhookService.createWebhook({ ...data, club_id: clubId });
      }
      setIsFormOpen(false);
      setEditingWebhook(undefined);
      loadWebhooks();
    } catch (error) {
      console.error("Error saving webhook:", error);
      alert("Failed to save webhook.");
    }
  };

  const handleToggleActive = async (id: string, is_active: boolean) => {
    try {
      await webhookService.updateWebhook(id, { is_active });
      loadWebhooks();
    } catch (error) {
      console.error("Error toggling webhook:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this webhook?")) return;
    try {
      await webhookService.deleteWebhook(id);
      loadWebhooks();
    } catch (error) {
      console.error("Error deleting webhook:", error);
    }
  };

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h5">Outbound Webhooks</Typography>
        <Button variant="contained" onClick={() => setIsFormOpen(true)}>
          Add Webhook
        </Button>
      </Box>

      <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
        Configure webhooks to automatically send notifications to your external services (like
        Discord or Slack) when events happen in your club.
      </Typography>

      <WebhookList
        webhooks={webhooks}
        onToggleActive={handleToggleActive}
        onEdit={(webhook) => {
          setEditingWebhook(webhook);
          setIsFormOpen(true);
        }}
        onDelete={handleDelete}
        onViewHistory={setViewHistoryWebhook}
      />

      <Dialog
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingWebhook(undefined);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogContent>
          <WebhookForm
            initialData={editingWebhook}
            onSubmit={handleCreateOrUpdate}
            onCancel={() => {
              setIsFormOpen(false);
              setEditingWebhook(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewHistoryWebhook}
        onClose={() => setViewHistoryWebhook(undefined)}
        fullWidth
        maxWidth="md"
      >
        <DialogContent>
          {viewHistoryWebhook && <DeliveryHistory webhook={viewHistoryWebhook} />}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

export default WebhooksSettings;
