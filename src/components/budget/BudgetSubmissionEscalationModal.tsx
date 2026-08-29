/**
 * Budget Submission Escalation Modal
 * Issue #4287
 * Allows club treasurers to draft budget line items with real-time financial tier
 * classification preview and instant policy feedback.
 */

import React, { useState } from 'react';
import {
  BudgetSubmissionInput,
  BudgetLineItem,
  BudgetTierCategory,
} from '../../types/budgetApprovalEscalation';
import {
  calculateBudgetTotal,
  evaluateBudgetThresholdTier,
} from '../../lib/budgetEscalationEngine';
import {
  DollarSign,
  Plus,
  Trash2,
  Sparkles,
  ShieldCheck,
  Send,
  AlertCircle,
  Clock,
  ShieldAlert,
} from 'lucide-react';

interface BudgetSubmissionEscalationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: BudgetSubmissionInput) => Promise<void>;
  defaultEventId?: string;
  defaultEventTitle?: string;
  defaultClubId?: string;
  defaultClubName?: string;
}

export const BudgetSubmissionEscalationModal: React.FC<
  BudgetSubmissionEscalationModalProps
> = ({
  isOpen,
  onClose,
  onSubmit,
  defaultEventId = 'evt-draft-1',
  defaultEventTitle = 'Campus AI Hackathon & Pizza Night',
  defaultClubId = 'club-tech',
  defaultClubName = 'Campus Tech Club',
}) => {
  const [eventTitle, setEventTitle] = useState(defaultEventTitle);
  const [clubName, setClubName] = useState(defaultClubName);
  const [submittedByName, setSubmittedByName] = useState('Alex Rivera (Treasurer)');
  const [lineItems, setLineItems] = useState<BudgetLineItem[]>([
    {
      id: 'li-1',
      category: 'food_catering',
      description: 'Catered Pizza & Soft Drinks',
      quantity: 4,
      unit_cost: 24.5,
      total_cost: 98.0,
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const totalAmount = calculateBudgetTotal(lineItems);
  const tierPreview = evaluateBudgetThresholdTier(totalAmount);

  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: `li-${Date.now()}`,
        category: 'food_catering',
        description: 'New Expense Item',
        quantity: 1,
        unit_cost: 50.0,
        total_cost: 50.0,
      },
    ]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const handleUpdateLineItem = (
    id: string,
    field: keyof BudgetLineItem,
    value: any
  ) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unit_cost') {
          updated.total_cost = Math.round(updated.quantity * updated.unit_cost * 100) / 100;
        }
        return updated;
      })
    );
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSubmit({
        event_id: defaultEventId,
        club_id: defaultClubId,
        club_name: clubName,
        event_title: eventTitle,
        submitted_by_name: submittedByName,
        line_items: lineItems,
      });
      onClose();
    } catch (err) {
      console.error('Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Submit Event Budget Request</h3>
              <p className="text-xs text-slate-400">
                Live Tiered Escalation Routing & Audit Trail Verification
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmitForm} className="space-y-4 text-xs">
          {/* Metadata */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Event Name</label>
              <input
                type="text"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Club / Org</label>
              <input
                type="text"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Line Items List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between font-semibold text-slate-300">
              <span>Itemized Expenses</span>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="flex items-center space-x-1 text-emerald-400 hover:text-emerald-300 font-bold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Line Item</span>
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {lineItems.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl grid grid-cols-12 gap-2 items-center"
                >
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      handleUpdateLineItem(item.id, 'description', e.target.value)
                    }
                    placeholder="Expense Description"
                    className="col-span-5 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs"
                  />

                  <select
                    value={item.category}
                    onChange={(e) =>
                      handleUpdateLineItem(item.id, 'category', e.target.value)
                    }
                    className="col-span-3 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs"
                  >
                    <option value="food_catering">Food & Catering</option>
                    <option value="equipment">Equipment</option>
                    <option value="speaker_fee">Speaker Fee</option>
                    <option value="venue">Venue</option>
                    <option value="marketing">Marketing</option>
                    <option value="other">Other</option>
                  </select>

                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      handleUpdateLineItem(item.id, 'quantity', Number(e.target.value))
                    }
                    className="col-span-1 px-1.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs text-center"
                  />

                  <input
                    type="number"
                    step="0.5"
                    value={item.unit_cost}
                    onChange={(e) =>
                      handleUpdateLineItem(item.id, 'unit_cost', Number(e.target.value))
                    }
                    className="col-span-2 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 text-xs text-right font-mono"
                  />

                  <button
                    type="button"
                    onClick={() => handleRemoveLineItem(item.id)}
                    className="col-span-1 text-slate-500 hover:text-rose-400 text-center"
                  >
                    <Trash2 className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Real-Time Tier Classification & Auto-Approval Feedback Widget */}
          <div
            className={`p-4 rounded-xl border space-y-1.5 ${
              tierPreview.is_auto_approved
                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                : tierPreview.assigned_queue === 'student_union_treasurer'
                ? 'bg-blue-950/30 border-blue-500/40 text-blue-300'
                : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
            }`}
          >
            <div className="flex items-center justify-between font-bold text-xs">
              <span className="flex items-center space-x-1.5">
                {tierPreview.is_auto_approved ? (
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>
                  {tierPreview.is_auto_approved
                    ? 'Instant System Auto-Approval Eligible'
                    : `Escalation Route: ${tierPreview.assigned_queue.replace(/_/g, ' ').toUpperCase()}`}
                </span>
              </span>
              <span className="font-mono text-sm">${totalAmount.toFixed(2)} USD</span>
            </div>
            <p className="text-[11px] text-slate-300">{tierPreview.rationale}</p>
            <div className="text-[10px] text-slate-400 font-mono pt-1">
              Audit Tag: <span className="font-bold">{tierPreview.audit_tag}</span>
            </div>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Submit Budget Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
