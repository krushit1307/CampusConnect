// src/lib/prospectus.ts
//
// Frontend client for the Sponsorship Prospectus Generator (Issue #2906).

import { supabase } from "./supabase/client";

export interface ProspectusMetrics {
    club_name: string;
    club_description: string | null;
    logo_url: string | null;
    banner_url: string | null;
    member_count: number;
    event_count: number;
    total_attendance: number;
    avg_attendance: number;
    majors: { major: string; count: number }[];
    growth: { year: number; members: number }[];
    tiers: { name: string; price: number; perks: string[] }[];
}

export interface ProspectusConfig {
    pitchText: string;
    selectedTiers: string[]; // Tier names to include
    primaryColor: string;   // Hex color for branding
}

/**
 * Fetch live aggregations for the prospectus.
 */
export async function fetchProspectusMetrics(clubId: string): Promise<ProspectusMetrics | null> {
    const { data, error } = await supabase.rpc("get_club_prospectus_metrics", {
        p_club_id: clubId,
    });

    if (error || !data) {
        console.error("[prospectus] Failed to fetch metrics:", error);
        return null;
    }
    return data as ProspectusMetrics;
}

/**
 * Generate a base64-encoded SVG bar chart for member growth.
 * This avoids the need for server-side canvas rendering.
 */
export function generateGrowthChartSVG(
    data: { year: number; members: number }[],
    primaryColor: string = "#6366f1"
): string {
    if (!data || data.length === 0) {
        return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><text x="20" y="100" fill="#888">No growth data available</text></svg>';
    }

    const width = 400;
    const height = 200;
    const padding = 40;
    const barWidth = (width - padding * 2) / data.length;
    const maxMembers = Math.max(...data.map((d) => d.members), 1);
    const chartHeight = height - padding * 2;

    const bars = data.map((d, i) => {
        const barHeight = (d.members / maxMembers) * chartHeight;
        const x = padding + i * barWidth + barWidth * 0.2;
        const y = height - padding - barHeight;
        const w = barWidth * 0.6;
        return `
            <rect x="${x}" y="${y}" width="${w}" height="${barHeight}" fill="${primaryColor}" rx="4" />
            <text x="${x + w / 2}" y="${height - padding + 20}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#555">${d.year}</text>
            <text x="${x + w / 2}" y="${y - 5}" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#333" font-weight="bold">${d.members}</text>
        `;
    }).join("");

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#ddd" stroke-width="1" />
        ${bars}
    </svg>`;

    // Convert to base64
    return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Generate the HTML document for the prospectus, which will be
 * passed to the browser's print-to-PDF function.
 */
export function generateProspectusHTML(
    metrics: ProspectusMetrics,
    config: ProspectusConfig
): string {
    const growthChartSrc = generateGrowthChartSVG(metrics.growth, config.primaryColor);
    const tiers = metrics.tiers.filter((t) => config.selectedTiers.includes(t.name));

    const tiersHTML = tiers.map((tier) => {
        const perksList = (tier.perks || []).map((p: string) => `<li>${p}</li>`).join("");
        return `
            <div class="tier-card" style="border-top: 4px solid ${config.primaryColor};">
                <h3>${tier.name}</h3>
                <p class="price">$${(tier.price / 100).toFixed(2)}</p>
                <ul>${perksList}</ul>
            </div>
        `;
    }).join("");

    const majorsList = metrics.majors.map((m) => `<li>${m.major}: ${m.count}</li>`).join("");

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${metrics.club_name} - Sponsorship Prospectus</title>
    <style>
        @page { margin: 0; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; margin: 0; padding: 0; }
        .header { padding: 40px; text-align: center; color: white; }
        .header img { max-width: 80px; max-height: 80px; border-radius: 50%; margin-bottom: 15px; }
        .header h1 { margin: 0; font-size: 32px; }
        .header p { margin: 5px 0 0; font-size: 16px; opacity: 0.9; }
        .content { padding: 40px; }
        .section { margin-bottom: 35px; }
        .section h2 { color: ${config.primaryColor}; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .pitch { font-style: italic; font-size: 16px; line-height: 1.6; color: #555; background: #f9f9f9; padding: 20px; border-radius: 8px; }
        .stats-grid { display: flex; gap: 20px; margin-top: 15px; }
        .stat-box { flex: 1; background: #f4f4f8; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-box .number { font-size: 28px; font-weight: bold; color: ${config.primaryColor}; }
        .stat-box .label { font-size: 12px; color: #666; text-transform: uppercase; margin-top: 5px; }
        .chart-container { text-align: center; margin: 20px 0; }
        .chart-container img { max-width: 100%; height: auto; }
        .tiers-grid { display: flex; gap: 15px; margin-top: 15px; }
        .tier-card { flex: 1; border: 1px solid #eee; border-radius: 8px; padding: 20px; text-align: center; }
        .tier-card .price { font-size: 24px; font-weight: bold; color: ${config.primaryColor}; margin: 10px 0; }
        .tier-card ul { list-style: none; padding: 0; font-size: 14px; color: #555; text-align: left; }
        .tier-card ul li { margin-bottom: 5px; padding-left: 15px; position: relative; }
        .tier-card ul li:before { content: "✓"; position: absolute; left: 0; color: ${config.primaryColor}; }
        .footer { padding: 20px 40px; background: #f4f4f8; text-align: center; font-size: 12px; color: #888; }
    </style>
</head>
<body>
    <div class="header" style="background: linear-gradient(135deg, ${config.primaryColor}, #1e1b4b);">
        ${metrics.logo_url ? `<img src="${metrics.logo_url}" alt="Logo" />` : ""}
        <h1>${metrics.club_name}</h1>
        <p>Sponsorship Prospectus ${new Date().getFullYear()}</p>
    </div>

    <div class="content">
        <div class="section">
            <h2>Our Pitch</h2>
            <p class="pitch">${config.pitchText || metrics.club_description || ""}</p>
        </div>

        <div class="section">
            <h2>By the Numbers</h2>
            <div class="stats-grid">
                <div class="stat-box">
                    <div class="number">${metrics.member_count}</div>
                    <div class="label">Active Members</div>
                </div>
                <div class="stat-box">
                    <div class="number">${metrics.event_count}</div>
                    <div class="label">Events Hosted</div>
                </div>
                <div class="stat-box">
                    <div class="number">${metrics.avg_attendance}</div>
                    <div class="label">Avg. Attendance</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>Membership Growth</h2>
            <div class="chart-container">
                <img src="${growthChartSrc}" alt="Growth Chart" />
            </div>
        </div>

        ${metrics.majors.length > 0 ? `
        <div class="section">
            <h2>Top Majors</h2>
            <ul>${majorsList}</ul>
        </div>
        ` : ""}

        ${tiers.length > 0 ? `
        <div class="section">
            <h2>Sponsorship Tiers</h2>
            <div class="tiers-grid">${tiersHTML}</div>
        </div>
        ` : ""}
    </div>

    <div class="footer">
        &copy; ${new Date().getFullYear()} ${metrics.club_name}. All rights reserved.<br>
        Generated by CampusConnect.
    </div>
</body>
</html>
    `;
}

/**
 * Open the generated HTML in a new window and trigger the browser's
 * print dialog (which the user can use to "Save as PDF").
 */
export function downloadProspectus(metrics: ProspectusMetrics, config: ProspectusConfig): void {
    const html = generateProspectusHTML(metrics, config);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        alert("Please allow pop-ups to download the prospectus.");
        return;
    }
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    // Wait for images to load before printing
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 500);
}
