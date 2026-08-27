// =============================================================================
// Utility: Social Embed Builders (Client-Side Preview)
// Issue: #3542 - Implement 'Automated Multi-Channel Cross-Posting'
// Description: Provides client - side utilities to generate preview HTML of
// what the Discord or Slack embed will look like, allowing club admins to
// verify the formatting before saving the webhook.
// =============================================================================

export interface EventPreviewData {
    title: string;
    description: string;
    event_date: string;
    location: string;
    cover_image_url: string | null;
    club_name: string;
}

/**
 * Generates a Tailwind-styled HTML string that mimics a Discord Embed.
 * Used in the IntegrationsManager UI for live previews.
 */
export function buildDiscordPreviewHTML(event: EventPreviewData): string {
    const dateStr = new Date(event.event_date).toLocaleString();

    return `
    <div class="border-l-4 border-indigo-500 bg-gray-100 dark:bg-gray-800 p-4 rounded-r-lg max-w-md shadow-sm">
      <div class="flex items-center gap-2 mb-2">
        <div class="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">C</div>
        <span class="font-bold text-gray-900 dark:text-white text-sm">CampusConnect Events</span>
        <span class="text-xs text-gray-500 dark:text-gray-400">BOT</span>
      </div>
      
      <div class="mt-2">
        <a href="#" class="text-indigo-600 dark:text-indigo-400 font-bold text-base hover:underline">
          🎉 ${event.title}
        </a>
        <p class="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-3">
          ${event.description.substring(0, 150)}${event.description.length > 150 ? '...' : ''}
        </p>
        
        <div class="grid grid-cols-3 gap-2 mt-3 text-xs">
          <div>
            <p class="font-bold text-gray-900 dark:text-white">📅 Date</p>
            <p class="text-gray-600 dark:text-gray-400">${dateStr}</p>
          </div>
          <div>
            <p class="font-bold text-gray-900 dark:text-white">📍 Location</p>
            <p class="text-gray-600 dark:text-gray-400">${event.location || 'TBA'}</p>
          </div>
          <div>
            <p class="font-bold text-gray-900 dark:text-white">🏢 Host</p>
            <p class="text-gray-600 dark:text-gray-400">${event.club_name}</p>
          </div>
        </div>
        
        ${event.cover_image_url ? `
          <div class="mt-3 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <img src="${event.cover_image_url}" alt="Event Poster" class="w-full h-32 object-cover" />
          </div>
        ` : ''}
        
        <div class="mt-3">
          <button class="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded text-xs font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
            🎟️ RSVP Here
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates a Tailwind-styled HTML string that mimics a Slack Block Kit message.
 */
export function buildSlackPreviewHTML(event: EventPreviewData): string {
    const dateStr = new Date(event.event_date).toLocaleString();

    return `
    <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 rounded-lg max-w-md shadow-sm">
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 bg-purple-600 rounded flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          CC
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2">
            <span class="font-bold text-gray-900 dark:text-white text-sm">CampusConnect</span>
            <span class="text-xs text-gray-500 dark:text-gray-400">Today at ${new Date().toLocaleTimeString()}</span>
          </div>
          
          <h3 class="text-lg font-black text-gray-900 dark:text-white mt-2">
            🎉 ${event.title}
          </h3>
          
          <p class="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">
            ${event.description.substring(0, 100)}${event.description.length > 100 ? '...' : ''}
          </p>
          
          <div class="grid grid-cols-3 gap-4 mt-4 text-xs">
            <div>
              <p class="font-bold text-gray-900 dark:text-white">📅 Date:</p>
              <p class="text-gray-600 dark:text-gray-400">${dateStr}</p>
            </div>
            <div>
              <p class="font-bold text-gray-900 dark:text-white">📍 Location:</p>
              <p class="text-gray-600 dark:text-gray-400">${event.location || 'TBA'}</p>
            </div>
            <div>
              <p class="font-bold text-gray-900 dark:text-white">🏢 Host:</p>
              <p class="text-gray-600 dark:text-gray-400">${event.club_name}</p>
            </div>
          </div>
          
          <div class="mt-4">
            <button class="px-4 py-1.5 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 transition-colors">
              🎟️ RSVP Now
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}
