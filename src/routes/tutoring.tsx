import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Clock, CheckCircle2, User, HelpCircle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

export default function TutoringBoard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [listingType, setListingType] = useState<"offer" | "request">("offer");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const { data: balance = 0, isLoading: loadingBalance } = useQuery({
    queryKey: ["tutoring_balance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutoring_balances")
        .select("balance")
        .eq("user_id", user?.id)
        .single();

      if (error && error.code !== "PGRST116") throw error; // Not found is fine (balance 0)
      return data?.balance || 0;
    },
    enabled: !!user,
  });

  const { data: listings = [], isLoading: loadingListings } = useQuery({
    queryKey: ["tutoring_listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutoring_listings")
        .select(`*, profiles:user_id (full_name, avatar_url)`)
        .eq("status", "open")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: sessions = [], isLoading: loadingSessions } = useQuery({
    queryKey: ["tutoring_sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutoring_sessions")
        .select(`*, provider:provider_id(full_name), receiver:receiver_id(full_name)`)
        .or(`provider_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createListing = useMutation({
    mutationFn: async () => {
      if (listingType === "request") {
        const { data, error } = await supabase.rpc("create_tutoring_request", {
          p_subject: subject,
          p_description: description,
        });
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase.from("tutoring_listings").insert({
          user_id: user?.id,
          listing_type: "offer",
          subject,
          description,
        });
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      toast.success("Listing created successfully");
      setIsDialogOpen(false);
      setSubject("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["tutoring_listings"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create listing");
    },
  });

  const acceptListing = useMutation({
    mutationFn: async (listingId: string) => {
      // Create session manually since we don't have accept_tutoring_listing RPC yet, or we can use normal insert if RLS allows.
      // Wait, let's implement the logic using RPC or direct insert.
      // I'll assume RLS allows users to create sessions involving themselves.
      const listing = listings.find((l) => l.id === listingId);
      if (!listing) throw new Error("Listing not found");

      const isOffer = listing.listing_type === "offer";
      const providerId = isOffer ? listing.user_id : user?.id;
      const receiverId = isOffer ? user?.id : listing.user_id;

      if (isOffer && balance < 1) {
        throw new Error("You need at least 1 credit to accept an offer");
      }

      const { data: sessionData, error: sessionError } = await supabase
        .from("tutoring_sessions")
        .insert({
          listing_id: listingId,
          provider_id: providerId,
          receiver_id: receiverId,
          subject: listing.subject,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Update listing status
      await supabase.from("tutoring_listings").update({ status: "fulfilled" }).eq("id", listingId);

      return sessionData;
    },
    onSuccess: () => {
      toast.success("Successfully accepted listing!");
      queryClient.invalidateQueries({ queryKey: ["tutoring_listings"] });
      queryClient.invalidateQueries({ queryKey: ["tutoring_sessions"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to accept listing");
    },
  });

  const confirmSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await supabase.rpc("confirm_tutoring_session", {
        p_session_id: sessionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Session confirmed!");
      queryClient.invalidateQueries({ queryKey: ["tutoring_sessions"] });
      queryClient.invalidateQueries({ queryKey: ["tutoring_balance"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to confirm session");
    },
  });

  if (!user)
    return <div className="p-8 text-center">Please log in to access the Tutoring Board.</div>;

  return (
    <div className="container mx-auto p-4 max-w-6xl space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tutoring & Time-Banking</h1>
          <p className="text-muted-foreground">Exchange knowledge with peers using time credits.</p>
        </div>
        <div className="flex items-center gap-4">
          <Card className="px-4 py-2 border-primary/20 bg-primary/5">
            <div className="text-sm text-muted-foreground font-medium">Your Balance</div>
            <div className="text-2xl font-bold text-primary">
              {loadingBalance ? <Loader2 className="h-4 w-4 animate-spin" /> : `${balance} Credits`}
            </div>
          </Card>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">Create Listing</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Post a Tutoring Listing</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="flex gap-4">
                  <Button
                    variant={listingType === "offer" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setListingType("offer")}
                  >
                    I want to teach (Offer)
                  </Button>
                  <Button
                    variant={listingType === "request" ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => setListingType("request")}
                  >
                    I need help (Request)
                  </Button>
                </div>
                {listingType === "request" && balance < 1 && (
                  <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md">
                    You need at least 1 credit to post a request. Earn credits by offering to teach!
                  </div>
                )}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject / Topic</label>
                  <Input
                    placeholder="e.g. Calculus II, React.js, Spanish"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Provide details about what you can teach or what you need help with..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={
                    !subject ||
                    (listingType === "request" && balance < 1) ||
                    createListing.isPending
                  }
                  onClick={() => createListing.mutate()}
                >
                  {createListing.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Post {listingType === "offer" ? "Offer" : "Request"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="board" className="w-full">
        <TabsList className="w-full md:w-auto">
          <TabsTrigger value="board" className="flex-1 md:flex-none">
            Open Board
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex-1 md:flex-none">
            My Sessions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="space-y-6 mt-6">
          {loadingListings ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : listings.length === 0 ? (
            <Card className="p-8 text-center">
              <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No open listings</h3>
              <p className="text-muted-foreground">Be the first to offer or request tutoring!</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {listings.map((listing: any) => (
                <Card key={listing.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <Badge variant={listing.listing_type === "offer" ? "default" : "secondary"}>
                        {listing.listing_type.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(listing.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <CardTitle className="mt-2 line-clamp-2">{listing.subject}</CardTitle>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <User className="h-4 w-4" />
                      {listing.profiles?.full_name || "Unknown User"}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-sm line-clamp-4">{listing.description}</p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={listing.listing_type === "offer" ? "default" : "outline"}
                      disabled={listing.user_id === user.id || acceptListing.isPending}
                      onClick={() => acceptListing.mutate(listing.id)}
                    >
                      {listing.user_id === user.id
                        ? "Your Listing"
                        : listing.listing_type === "offer"
                          ? "Accept Offer (-1 Credit)"
                          : "Help Them (+1 Credit)"}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6 mt-6">
          {loadingSessions ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <Card className="p-8 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No active sessions</h3>
              <p className="text-muted-foreground">Accept a listing to start a session.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {sessions.map((session: any) => {
                const isProvider = session.provider_id === user.id;
                const otherParty = isProvider
                  ? session.receiver?.full_name
                  : session.provider?.full_name;
                const myConfirmation = isProvider
                  ? session.provider_confirmed
                  : session.receiver_confirmed;

                return (
                  <Card key={session.id}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{session.subject}</CardTitle>
                          <CardDescription className="mt-1">
                            {isProvider ? "Teaching " : "Learning from "}
                            <span className="font-medium text-foreground">{otherParty}</span>
                          </CardDescription>
                        </div>
                        <Badge variant={session.status === "completed" ? "secondary" : "default"}>
                          {session.status.toUpperCase()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="text-sm flex gap-4">
                          <div className="flex items-center gap-1">
                            {session.provider_confirmed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500" />
                            )}
                            <span>Provider Confirmed</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {session.receiver_confirmed ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Clock className="h-4 w-4 text-amber-500" />
                            )}
                            <span>Receiver Confirmed</span>
                          </div>
                        </div>
                        {session.status === "pending" && (
                          <Button
                            disabled={myConfirmation || confirmSession.isPending}
                            onClick={() => confirmSession.mutate(session.id)}
                          >
                            {confirmSession.isPending ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            {myConfirmation ? "Waiting for other party" : "Sign & Confirm Session"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
