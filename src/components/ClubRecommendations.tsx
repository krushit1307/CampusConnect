import React, { useState, useEffect } from 'react';
import { getRecommendedClubs, RecommendedClub, encodeUserInterests } from '@/lib/recommendations';
import { Loader2, Sparkles, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Example master tag list (should ideally be fetched from DB or config)
const MASTER_TAG_LIST = [
  'Coding', 'Sports', 'Gaming', 'Music', 'Art', 'Debate', 'Robotics', 'Photography'
];

interface ClubRecommendationsProps {
  /** The current user's selected interests */
  userInterests?: string[];
}

/**
 * ClubRecommendations Component
 * 
 * Displays a "Recommended for You" section. It intelligently analyzes the user's 
 * interests using the backend cosine similarity algorithm. If the user has no 
 * interests (Cold Start), it gracefully falls back to displaying the most popular clubs.
 */
export const ClubRecommendations: React.FC<ClubRecommendationsProps> = ({ 
  userInterests = [] 
}) => {
  const [recommendations, setRecommendations] = useState<RecommendedClub[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Encode interests into a numeric vector
        const userVector = encodeUserInterests(userInterests, MASTER_TAG_LIST);
        
        // Fetch from the pgvector RPC function
        const results = await getRecommendedClubs(userVector, 5);
        setRecommendations(results);
      } catch (err) {
        setError('Unable to load recommendations at this time.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, [userInterests]);

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Recommended for You
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Analyzing your interests...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full border-destructive/50">
        <CardContent className="py-6">
          <p className="text-sm text-destructive text-center">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card className="w-full">
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">
            No specific recommendations found. Try adding more interests to your profile!
          </p>
        </CardContent>
      </Card>
    );
  }

  const isColdStart = recommendations[0]?.is_cold_start;

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isColdStart ? (
            <>
              <Users className="h-5 w-5 text-primary" />
              Popular Clubs
            </>
          ) : (
            <>
              <Sparkles className="h-5 w-5 text-primary" />
              Recommended for You
            </>
          )}
        </CardTitle>
        <CardDescription>
          {isColdStart 
            ? "Tell us your interests to get personalized club recommendations!" 
            : "Clubs that match your interests with high similarity."}
        </CardDescription
      </CardHeader>
      <CardContent className="space-y-4">
        {recommendations.map((club) => (
          <div 
            key={club.club_id} 
            className="flex items-start justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="space-y-1 flex-1">
              <Link to={`/clubs/${club.club_id}`} className="font-semibold text-lg hover:underline">
                {club.club_name}
              </Link>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {club.club_description}
              </p>
              {!isColdStart && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    {(club.similarity_score * 100).toFixed(0)}% Match
                  </span>
                </div>
              )}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to={`/clubs/${club.club_id}`}>View</Link>
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ClubRecommendations;
