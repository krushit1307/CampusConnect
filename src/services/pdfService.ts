import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

class Semaphore {
  private running = 0;
  private readonly limit = 2;
  private queue: (() => void)[] = [];

  async acquire() {
    if (this.running < this.limit) {
      this.running++;
      return;
    }

    await new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  release() {
    this.running--;

    const next = this.queue.shift();

    if (next) next();
  }
}

const semaphore = new Semaphore();

export async function generatePdf(url: string) {
  await semaphore.acquire();

  let browser: puppeteer.Browser | null = null;

  try {
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: true,
    });

    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: "networkidle0",
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    return pdf;
  } finally {
    if (browser) {
      await browser.close();
    }

    semaphore.release();
  }
}
