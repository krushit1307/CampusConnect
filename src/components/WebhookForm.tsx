import React, { useState } from "react";
import {
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  TextField,
  Typography,
  Box,
} from "@mui/material";
import { Webhook } from "../../services/webhookService";

interface WebhookFormData {
  url: string;
  secret: string;
  events_subscribed: string[];
  is_active: boolean;
}

interface WebhookFormProps {
  initialData?: Webhook;
  onSubmit: (data: WebhookFormData) => void;
  onCancel: () => void;
}

const AVAILABLE_EVENTS = [
  "event.created",
  "event.updated",
  "event.deleted",
  "post.created",
  "club.updated",
  "member.joined",
  "member.left",
];

export const WebhookForm: React.FC<WebhookFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [url, setUrl] = useState(initialData?.url || "");
  const [secret, setSecret] = useState(initialData?.secret || crypto.randomUUID());
  const [events, setEvents] = useState<string[]>(
    initialData?.events_subscribed || ["event.created"],
  );
  const [isActive, setIsActive] = useState(initialData?.is_active ?? true);

  const handleEventToggle = (event: string) => {
    setEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ url, secret, events_subscribed: events, is_active: isActive });
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
    >
      <Typography variant="h6">{initialData ? "Edit Webhook" : "Add Webhook"}</Typography>

      <TextField
        label="Webhook URL"
        required
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://your-server.com/webhook"
        type="url"
        fullWidth
      />

      <TextField
        label="Webhook Secret (HMAC Signature Key)"
        value={secret}
        disabled
        fullWidth
        helperText="Used to sign requests so you can verify they came from us."
      />
      <Button
        variant="outlined"
        onClick={() => setSecret(crypto.randomUUID())}
        sx={{ alignSelf: "flex-start" }}
      >
        Regenerate Secret
      </Button>

      <Typography variant="subtitle1" sx={{ mt: 2 }}>
        Events to subscribe to:
      </Typography>
      <FormGroup row>
        {AVAILABLE_EVENTS.map((evt) => (
          <FormControlLabel
            key={evt}
            control={
              <Checkbox checked={events.includes(evt)} onChange={() => handleEventToggle(evt)} />
            }
            label={evt}
          />
        ))}
      </FormGroup>

      <FormControlLabel
        control={<Checkbox checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
        label="Active"
      />

      <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
        <Button type="submit" variant="contained" color="primary">
          Save Webhook
        </Button>
        <Button variant="text" onClick={onCancel}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
};
