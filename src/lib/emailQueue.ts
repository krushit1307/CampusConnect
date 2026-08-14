import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";

// 1. Redis Connection Setup
// Hum localhost:6379 par connect kar rahe hain jo humne pehle start kiya tha
const redisConnection = new Redis({
  host: "127.0.0.1",
  port: 6379,
  maxRetriesPerRequest: null, // BullMQ ke liye recommended setting
});

// 2. Queue Initialization
// Ye wo queue hai jahan "Send Announcement" API job push karegi
export const announcementEmailQueue = new Queue("announcement-email-queue", {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5, // Agar fail ho toh 5 baar retry karega
    backoff: {
      type: "exponential", // Exponential Backoff: 1 min, 2 min, 4 min, 8 min...
      delay: 60000, // Pehli retry 60,000 ms (1 minute) baad
    },
    removeOnComplete: true, // Successful jobs ko queue se hata do taaki Redis memory full na ho
    removeOnFail: false, // Failed jobs ko debug ke liye rakho
  },
});

// 3. Worker Setup
// Ye background mein chalta rahega aur queue se jobs utha kar process karega
export const announcementEmailWorker = new Worker(
  "announcement-email-queue",
  async (job: Job) => {
    console.log(`🚀 Processing job ${job.id} for announcement...`);

    const { announcementData, userEmails } = job.data;
    const totalEmails = userEmails.length;

    // Hum emails ko chunks (batches) mein bhejenge taaki server crash na ho
    const chunkSize = 100;

    for (let i = 0; i < totalEmails; i += chunkSize) {
      const chunk = userEmails.slice(i, i + chunkSize);

      // TODO: Yahan actual email sending logic aayega (e.g., SendGrid/Nodemailer)
      // await sendEmails(chunk, announcementData);

      // Fake delay to simulate email sending (Testing ke liye)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 4. Live Progress Update (Frontend loading bar ke liye)
      const progress = Math.min(100, Math.round(((i + chunkSize) / totalEmails) * 100));
      await job.updateProgress(progress);

      console.log(`✅ Job ${job.id}: ${progress}% emails sent...`);
    }

    console.log(`🎉 Job ${job.id} completed successfully!`);
    return { success: true, totalSent: totalEmails };
  },
  {
    connection: redisConnection,
    concurrency: 1, // Ek time par ek hi job process karega taaki overload na ho
  },
);

// Helper function jo API se call hoga job add karne ke liye
export const addAnnouncementJob = async (jobData: any) => {
  const job = await announcementEmailQueue.add("send-announcement-emails", jobData);
  return job.id;
};
