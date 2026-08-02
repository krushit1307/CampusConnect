/**
 * Comment Service
 * Handles comment creation with automated profanity filtering via Edge Function.
 */
import { supabase } from "../lib/supabaseClient";

export interface CreateCommentParams {
    postId: string;
    content: string;
    authorId: string;
}

export const createComment = async (params: CreateCommentParams) => {
    const { postId, content, authorId } = params;

    // 1. Call the Edge Function to validate the comment content
    const { data: validationData, error: validationError } = await supabase.functions.invoke(
        "validate-comment",
        {
            body: {
                content,
                userId: authorId,
                postId,
            },
        }
    );

    // 2. Handle validation rejection (400 Bad Request from Edge Function)
    if (validationError || (validationData as any)?.blocked) {
        throw new Error(
            (validationData as any)?.error || "Your comment violates our community guidelines."
        );
    }

    // 3. If validation passes, insert the comment into the database
    const { data, error } = await supabase
        .from("comments")
        .insert({
            post_id: postId,
            author_id: authorId,
            content: content.trim(),
        })
        .select()
        .single();

    if (error) {
        console.error("Database error creating comment:", error);
        throw new Error("Failed to create comment.");
    }

    return data;
};
