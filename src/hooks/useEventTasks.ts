import { useQuery, useMutation, useQueryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { EventTask, CreateEventTaskInput, UpdateEventTaskInput } from "@/types/eventTasks";
import { toast } from "sonner";

export function useEventTasks(eventId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const queryKey = ["event_tasks", eventId];

  // Fetch tasks for event
  const {
    data: tasks = [],
    isLoading,
    error,
  } = useQuery<EventTask[]>({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tasks")
        .select("*")
        .eq("event_id", eventId)
        .order("start_date", { ascending: true });

      if (error) throw new Error(error.message);
      return data as EventTask[];
    },
    enabled: !!eventId,
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (newTask: Omit<CreateEventTaskInput, "event_id">) => {
      const { data, error } = await supabase
        .from("event_tasks")
        .insert({
          event_id: eventId,
          ...newTask,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as EventTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Task added successfully");
    },
    onError: (err: Error) => {
      toast.error(`Failed to add task: ${err.message}`);
    },
  });

  // Update task mutation (handles drag-and-drop date shifts, progress changes, etc.)
  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateEventTaskInput) => {
      const { data, error } = await supabase
        .from("event_tasks")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as EventTask;
    },
    onMutate: async (updatedTask) => {
      await queryClient.cancelQueries({ queryKey });
      const previousTasks = queryClient.getQueryData<EventTask[]>(queryKey);

      if (previousTasks) {
        queryClient.setQueryData<EventTask[]>(
          queryKey,
          previousTasks.map((task) =>
            task.id === updatedTask.id ? { ...task, ...updatedTask } : task,
          ),
        );
      }

      return { previousTasks };
    },
    onError: (err: Error, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(queryKey, context.previousTasks);
      }
      toast.error(`Failed to update task: ${err.message}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("event_tasks").delete().eq("id", taskId);

      if (error) throw new Error(error.message);
      return taskId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Task deleted");
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete task: ${err.message}`);
    },
  });

  return {
    tasks,
    isLoading,
    error,
    createTask: createTaskMutation.mutate,
    createTaskAsync: createTaskMutation.mutateAsync,
    isCreating: createTaskMutation.isPending,
    updateTask: updateTaskMutation.mutate,
    updateTaskAsync: updateTaskMutation.mutateAsync,
    isUpdating: updateTaskMutation.isPending,
    deleteTask: deleteTaskMutation.mutate,
    isDeleting: deleteTaskMutation.isPending,
  };
}
