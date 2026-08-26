import { Queue } from "bullmq";
import { redisConnection } from "./connection";

// Define the PhotoProcessing queue
export const photoQueue = new Queue("PhotoProcessing", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000, // wait 5s before first retry
    },
  },
});
