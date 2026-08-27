import { useState } from "react";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import MessageCircleQuestion from "lucide-react/dist/esm/icons/message-circle-question";
import Send from "lucide-react/dist/esm/icons/send";
import CheckCircle2 from "lucide-react/dist/esm/icons/check-circle-2";
import User from "lucide-react/dist/esm/icons/user";
import UserX from "lucide-react/dist/esm/icons/user-x";
import Clock from "lucide-react/dist/esm/icons/clock";
import Edit2 from "lucide-react/dist/esm/icons/edit-2";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const askFormSchema = z.object({
  question: z
    .string()
    .min(5, "Question must be at least 5 characters.")
    .max(500, "Question is too long."),
  is_anonymous: z.boolean().default(false),
});

type FaqPublic = {
  id: string;
  event_id: string;
  question: string;
  answer: string;
  asked_by: string | null;
  is_anonymous: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  author_name: string;
  author_avatar: string | null;
};

type FaqInbox = {
  id: string;
  question: string;
  is_anonymous: boolean;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string;
  } | null;
};

type FaqDuplicate = {
  id: string;
  question: string;
  answer: string;
  similarity: number;
};

export function EventFaqSection({
  eventId,
  isOrganizer,
  userId,
}: {
  eventId: string;
  isOrganizer: boolean;
  userId?: string;
}) {
  const supabase = createClient();

  const [askMode, setAskMode] = useState<"compose" | "duplicates">("compose");
  const [duplicateSuggestions, setDuplicateSuggestions] = useState<FaqDuplicate[]>([]);

  // 1. Fetch Public FAQs
  const {
    data: publicFaqs = [],
    isLoading: isLoadingPublic,
    refetch: refetchPublic,
  } = useQuery({
    queryKey: ["event_faqs_public", eventId],
    queryFn: async () => {
      if (eventId.startsWith("mock-")) return [];
      const { data, error } = await supabase.rpc("get_public_event_faqs", { p_event_id: eventId });
      if (error) throw error;
      return data;
    },
  });

  // 2. Fetch Inbox (Organizer only)
  const {
    data: inboxFaqs = [],
    isLoading: isLoadingInbox,
    refetch: refetchInbox,
  } = useQuery({
    queryKey: ["event_faqs_inbox", eventId],
    enabled: isOrganizer,
    queryFn: async () => {
      if (eventId.startsWith("mock-")) return [];
      const { data, error } = await supabase
        .from("event_faqs")
        .select(`id, question, is_anonymous, created_at, profiles(full_name, avatar_url)`)
        .eq("event_id", eventId)
        .eq("is_published", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<z.infer<typeof askFormSchema>>({
    resolver: zodResolver(askFormSchema),
    defaultValues: { question: "", is_anonymous: false },
  });

  const isAnonymous = watch("is_anonymous");

  // Duplicate Check Mutation
  const checkDuplicatesMutation = useMutation({
    mutationFn: async (question: string) => {
      const { data, error } = await supabase.rpc("find_similar_published_faqs", {
        p_event_id: eventId,
        p_question: question,
      });
      if (error) throw error;
      return data || [];
    },
    onSuccess: (data, variables) => {
      if (data.length > 0) {
        setDuplicateSuggestions(data);
        setAskMode("duplicates");
      } else {
        submitQuestionMutation.mutate(variables);
      }
    },
    onError: (error) => {
      console.error("Duplicate check failed, proceeding to submit:", error);
      submitQuestionMutation.mutate(watch("question"));
    },
  });

  // Final Submit Mutation
  const submitQuestionMutation = useMutation({
    mutationFn: async (question: string) => {
      if (!userId) throw new Error("Must be logged in to ask a question.");
      const { error } = await supabase.from("event_faqs").insert({
        event_id: eventId,
        question,
        asked_by: userId,
        is_anonymous: isAnonymous,
        is_published: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Question submitted successfully!");
      reset();
      setAskMode("compose");
      if (isOrganizer) {
        refetchInbox();
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to submit question.");
    },
  });

  const onAskSubmit = (values: z.infer<typeof askFormSchema>) => {
    if (!userId) {
      toast.error("You must be logged in to ask a question.");
      return;
    }
    // Only check duplicates if we haven't already
    if (askMode === "compose") {
      checkDuplicatesMutation.mutate(values.question);
    }
  };

  const forceSubmit = () => {
    submitQuestionMutation.mutate(watch("question"));
  };

  // Organizer: Publish Answer
  const publishMutation = useMutation({
    mutationFn: async ({ faqId, answer }: { faqId: string; answer: string }) => {
      const { error } = await supabase
        .from("event_faqs")
        .update({ answer, is_published: true })
        .eq("id", faqId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Answer published!");
      refetchPublic();
      refetchInbox();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to publish answer.");
    },
  });

  // Organizer: Edit Published Answer
  const editMutation = useMutation({
    mutationFn: async ({ faqId, answer }: { faqId: string; answer: string }) => {
      const { error } = await supabase.from("event_faqs").update({ answer }).eq("id", faqId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Answer updated!");
      refetchPublic();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to edit answer.");
    },
  });

  return (
    <div className="mt-12 border-t-2 border-black pt-8">
      <div className="flex items-center gap-2 mb-6">
        <MessageCircleQuestion className="h-6 w-6 text-blue-900" />
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-blue-900">
          Q&A
        </h2>
      </div>

      <Tabs defaultValue="public" className="w-full">
        <TabsList className="neu-border bg-white rounded-none p-1 border-2 border-black mb-6 w-full justify-start h-auto flex-wrap">
          <TabsTrigger
            value="public"
            className="rounded-none font-mono text-sm font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white"
          >
            Public FAQs
          </TabsTrigger>
          {isOrganizer && (
            <TabsTrigger
              value="inbox"
              className="rounded-none font-mono text-sm font-bold uppercase data-[state=active]:bg-black data-[state=active]:text-white"
            >
              Organizer Inbox
              {inboxFaqs.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center bg-lime text-black rounded-full h-5 w-5 text-xs">
                  {inboxFaqs.length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="public" className="space-y-8">
          {isLoadingPublic ? (
            <div className="animate-pulse space-y-4">
              <div className="h-12 bg-black/10 neu-border w-full"></div>
              <div className="h-12 bg-black/10 neu-border w-full"></div>
            </div>
          ) : publicFaqs.length === 0 ? (
            <div className="text-center py-8 neu-border bg-peach/20">
              <p className="font-mono text-sm font-bold text-black/60">
                No questions have been published yet.
              </p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-4">
              {publicFaqs.map((faq: FaqPublic) => (
                <AccordionItem
                  key={faq.id}
                  value={faq.id}
                  className="neu-border border-2 border-black bg-white px-4"
                >
                  <AccordionTrigger className="font-display text-lg font-bold hover:no-underline text-left py-4">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 font-mono text-base text-gray-700">
                    <div className="bg-lime/20 p-4 neu-border mb-2">{faq.answer}</div>

                    <div className="flex items-center justify-between mt-4 text-xs font-bold text-black/50">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          {faq.is_anonymous ? <UserX size={14} /> : <User size={14} />}
                          Asked by {faq.author_name}
                        </span>

                        {faq.updated_at !== faq.created_at && (
                          <span
                            className="flex items-center gap-1"
                            title={new Date(faq.updated_at).toLocaleString()}
                          >
                            <Clock size={14} />
                            Updated{" "}
                            {formatDistanceToNow(new Date(faq.updated_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>

                      {isOrganizer && (
                        <EditPublishedAnswer
                          faq={faq}
                          onSave={editMutation.mutate}
                          isPending={editMutation.isPending}
                        />
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}

          {/* Ask a Question Form */}
          <div className="neu-border bg-pink-100 p-6 mt-8">
            <h3 className="font-display text-xl font-bold mb-4">Ask a Question</h3>

            {askMode === "compose" ? (
              <form onSubmit={handleSubmit(onAskSubmit)} className="space-y-4">
                <Textarea
                  {...register("question")}
                  placeholder="What would you like to know about this event?"
                  className="neu-border bg-white border-2 border-black resize-none min-h-[100px]"
                />
                {errors.question && (
                  <p className="text-red-500 font-mono text-xs font-bold">
                    {errors.question.message}
                  </p>
                )}

                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="anonymous"
                      checked={isAnonymous}
                      onCheckedChange={(c) => setValue("is_anonymous", c === true)}
                    />
                    <Label
                      htmlFor="anonymous"
                      className="font-mono text-sm font-bold cursor-pointer"
                    >
                      Ask anonymously
                    </Label>
                  </div>

                  <Button
                    type="submit"
                    disabled={checkDuplicatesMutation.isPending || submitQuestionMutation.isPending}
                    className="neu-border neu-press bg-black text-cream hover:bg-black/90 font-mono font-bold uppercase tracking-wider"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {checkDuplicatesMutation.isPending || submitQuestionMutation.isPending
                      ? "Submitting..."
                      : "Submit Question"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="bg-white neu-border p-4 border-2 border-black flex gap-3 items-start">
                  <CheckCircle2 className="text-blue-600 mt-1 shrink-0" />
                  <div>
                    <h4 className="font-bold font-display text-lg">
                      Your question may already be answered!
                    </h4>
                    <p className="font-mono text-sm mt-1 mb-4 text-gray-700">
                      We found these existing published FAQs that might help:
                    </p>
                    <ul className="space-y-4">
                      {duplicateSuggestions.map((dup, i) => (
                        <li key={i} className="bg-lime/20 p-3 neu-border">
                          <p className="font-bold font-display mb-1">Q: {dup.question}</p>
                          <p className="font-mono text-sm">A: {dup.answer}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <Button
                    onClick={() => setAskMode("compose")}
                    variant="outline"
                    className="neu-border neu-press bg-white font-mono font-bold"
                  >
                    Edit my question
                  </Button>
                  <Button
                    onClick={forceSubmit}
                    disabled={submitQuestionMutation.isPending}
                    className="neu-border neu-press bg-black text-cream font-mono font-bold"
                  >
                    {submitQuestionMutation.isPending ? "Submitting..." : "Submit anyway"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {isOrganizer && (
          <TabsContent value="inbox" className="space-y-4">
            {isLoadingInbox ? (
              <div className="animate-pulse h-20 bg-black/10 neu-border w-full"></div>
            ) : inboxFaqs.length === 0 ? (
              <div className="text-center py-8 neu-border bg-lime/20">
                <p className="font-mono text-sm font-bold text-black/60">
                  No pending questions in the inbox! 🎉
                </p>
              </div>
            ) : (
              inboxFaqs.map((faq: FaqInbox) => (
                <InboxItem
                  key={faq.id}
                  faq={faq}
                  onPublish={publishMutation.mutate}
                  isPending={publishMutation.isPending}
                />
              ))
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// Subcomponents

function InboxItem({
  faq,
  onPublish,
  isPending,
}: {
  faq: FaqInbox;
  onPublish: (params: { faqId: string; answer: string }) => void;
  isPending: boolean;
}) {
  const [answer, setAnswer] = useState("");
  const authorName = faq.is_anonymous
    ? "Anonymous Attendee"
    : faq.profiles?.full_name || "Unknown User";

  return (
    <div className="neu-border bg-white border-2 border-black p-4 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        {faq.is_anonymous ? (
          <UserX className="h-5 w-5 text-gray-400" />
        ) : (
          <User className="h-5 w-5 text-blue-600" />
        )}
        <span className="font-mono text-sm font-bold">{authorName}</span>
        <span className="text-xs text-gray-400 font-mono flex-1 text-right">
          {new Date(faq.created_at).toLocaleDateString()}
        </span>
      </div>
      <p className="font-display text-lg font-bold">{faq.question}</p>

      <div className="mt-4">
        <Textarea
          placeholder="Type your answer here..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          className="neu-border bg-peach/10 resize-none"
        />
        <div className="flex justify-end mt-2">
          <Button
            disabled={answer.trim().length < 5 || isPending}
            onClick={() => onPublish({ faqId: faq.id, answer: answer.trim() })}
            className="neu-border neu-press bg-lime text-black font-mono font-bold uppercase"
          >
            Publish Answer
          </Button>
        </div>
      </div>
    </div>
  );
}

function EditPublishedAnswer({
  faq,
  onSave,
  isPending,
}: {
  faq: FaqPublic;
  onSave: (params: { faqId: string; answer: string }, options: { onSuccess: () => void }) => void;
  isPending: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [answer, setAnswer] = useState(faq.answer);

  if (!isEditing) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsEditing(true)}
        className="text-blue-600 hover:text-blue-800 font-mono text-xs font-bold"
      >
        <Edit2 size={14} className="mr-1" /> Edit Answer
      </Button>
    );
  }

  return (
    <div className="mt-4 border-t border-black/10 pt-4 w-full">
      <Label className="font-mono text-xs font-bold mb-2 block">Edit Answer</Label>
      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        className="neu-border bg-white mb-2"
      />
      <div className="flex items-center gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsEditing(false);
            setAnswer(faq.answer);
          }}
          className="neu-border font-mono text-xs"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={answer.trim().length < 5 || isPending || answer === faq.answer}
          onClick={() => {
            onSave(
              { faqId: faq.id, answer: answer.trim() },
              {
                onSuccess: () => setIsEditing(false),
              },
            );
          }}
          className="neu-border font-mono text-xs bg-black text-white"
        >
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
