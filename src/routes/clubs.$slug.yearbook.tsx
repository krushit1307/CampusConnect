import React, { useEffect, useState, useRef } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { createClient } from '@/lib/supabase/client';
import { useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';

const supabase = createClient();

interface YearbookData {
  clubName: string;
  logoUrl: string;
  brandColors: { primary: string; secondary: string };
  metrics: { totalEvents: number; totalAttendance: number; fundsRaised: number };
  topEvents: Array<{ title: string; attendance: number }>;
  executives: Array<{ name: string; role: string; avatarUrl: string }>;
  gallery: string[];
}

export default function DigitalYearbook() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<YearbookData | null>(null);
  const [loading, setLoading] = useState(true);
  const bookRef = useRef<any>(null);

  useEffect(() => {
    async function fetchYearbookData() {
      if (!slug) return;
      try {
        // 1. Fetch Club Profile Branding Settings
        const { data: club } = await supabase
          .from('clubs')
          .select('id, name, logo_url, brand_colors')
          .eq('slug', slug)
          .single();

        if (!club) throw new Error("Club not found");

        const clubId = club.id;

        // 2. Aggregate core metrics & past event metadata
        const { data: events } = await supabase
          .from('events')
          .select('title, attendance_count')
          .eq('club_id', clubId)
          .order('attendance_count', { ascending: false });

        // 3. Collect asset URLs from Event Media Carousel
        const { data: galleryItems } = await supabase
          .from('event_gallery')
          .select('image_url')
          .eq('club_id', clubId)
          .limit(10);

        // 4. Fetch Active Management/Executive Team Roster
        const { data: execs } = await supabase
          .from('club_executives')
          .select('name, role, avatar_url')
          .eq('club_id', clubId);

        const totalAttendance = events?.reduce((acc, curr) => acc + (curr.attendance_count || 0), 0) || 0;
        
        setData({
          clubName: club.name || 'Our Club',
          logoUrl: club.logo_url || '/default-logo.png',
          brandColors: club.brand_colors || { primary: '#1e3a8a', secondary: '#f59e0b' },
          metrics: { totalEvents: events?.length || 0, totalAttendance, fundsRaised: 4250 }, 
          topEvents: events?.slice(0, 3) || [],
          executives: execs || [],
          gallery: galleryItems?.map(item => item.image_url) || []
        });
      } catch (error) {
        console.error('Error compiling yearbook payload:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchYearbookData();
  }, [slug]);

  if (loading) return <div className="flex h-screen items-center justify-center font-medium text-gray-500">Compiling your yearbook...</div>;
  if (!data) return <div className="flex h-screen items-center justify-center text-gray-500">Yearbook records not found.</div>;

  return (
    <>
      <Helmet>
        <title>2026 Digital Yearbook | {data.clubName}</title>
        <meta name="description" content={`Relive this year's top milestones, metrics, and core photographic memories for ${data.clubName}.`} />
        
        <meta property="og:title" content={`2026 Club Year in Review | ${data.clubName}`} />
        <meta property="og:description" content="Check out our accomplishments, executive leadership highlights, and event galleries." />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={data.logoUrl} />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`2026 Club Year in Review | ${data.clubName}`} />
        <meta name="twitter:description" content="Relive this year's top milestones, metrics, and core photographic memories." />
      </Helmet>

      <div className="min-h-screen bg-neutral-900 py-12 flex flex-col items-center justify-center overflow-hidden">
        {/* 3D PageFlip Container Framework */}
        <div className="shadow-2xl rounded-lg overflow-hidden border border-neutral-800 bg-neutral-950">
          {/* @ts-ignore */}
          <HTMLFlipBook width={500} height={650} size="fixed" showCover={true} ref={bookRef} className="yearbook-canvas">
            
            {/* PAGE 1: STYLIZED COVER PAGE */}
            <div className="bg-cover flex flex-col items-center justify-between p-12 text-center text-white relative border-r border-neutral-800" style={{ backgroundColor: data.brandColors.primary }}>
              <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
              <div className="z-10 mt-12">
                <span className="text-xs uppercase tracking-widest text-white/70 font-semibold">Annual Digital Review</span>
                <h1 className="text-4xl font-black mt-2 tracking-tight uppercase">{data.clubName}</h1>
                <div className="w-16 h-1 mt-4 mx-auto rounded" style={{ backgroundColor: data.brandColors.secondary }} />
              </div>
              <img src={data.logoUrl} alt="Logo" className="w-32 h-32 object-contain z-10 rounded-full shadow-lg bg-white p-2" />
              <div className="z-10 text-xl font-bold tracking-widest text-white/90 mb-8">CLASS OF 2026</div>
            </div>

            {/* PAGE 2: IMPACT METRICS BRIEFING */}
            <div className="bg-white p-12 flex flex-col justify-between border-l border-neutral-200">
              <div>
                <h2 className="text-2xl font-black text-neutral-900 border-b pb-2 mb-6">THE YEAR IN NUMBERS</h2>
                <div className="grid grid-cols-1 gap-6">
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="block text-xs uppercase tracking-wider text-neutral-500 font-bold">Total Operations</span>
                    <span className="text-3xl font-extrabold text-neutral-900">{data.metrics.totalEvents} Live Events</span>
                  </div>
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="block text-xs uppercase tracking-wider text-neutral-500 font-bold">Community Footprint</span>
                    <span className="text-3xl font-extrabold text-neutral-900">{data.metrics.totalAttendance.toLocaleString()} Attendees</span>
                  </div>
                  <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
                    <span className="block text-xs uppercase tracking-wider text-neutral-500 font-bold">Philanthropy Channels</span>
                    <span className="text-3xl font-extrabold text-neutral-900">${data.metrics.fundsRaised.toLocaleString()} Raised</span>
                  </div>
                </div>
              </div>
              <span className="text-xs text-neutral-400 font-medium">Page 1</span>
            </div>

            {/* PAGE 3: TOP PACKED ENGAGEMENTS */}
            <div className="bg-white p-12 flex flex-col justify-between border-r border-neutral-200">
              <div>
                <h2 className="text-2xl font-black text-neutral-900 border-b pb-2 mb-6">PREMIUM ENGAGEMENTS</h2>
                <ul className="space-y-4">
                  {data.topEvents.map((event, index) => (
                    <li key={index} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-lg font-bold text-neutral-300">#0{index + 1}</span>
                        <span className="font-semibold text-neutral-800">{event.title}</span>
                      </div>
                      <span className="text-xs font-bold px-2 py-1 rounded bg-neutral-200 text-neutral-700">{event.attendance} deep</span>
                    </li>
                  ))}
                </ul>
              </div>
              <span className="text-xs text-neutral-400 font-medium text-right">Page 2</span>
            </div>

            {/* PAGE 4: EXECUTIVE CORE LEADER GRID */}
            <div className="bg-white p-12 flex flex-col justify-between border-l border-neutral-200">
              <div>
                <h2 className="text-2xl font-black text-neutral-900 border-b pb-2 mb-6">EXECUTIVE LEADERSHIP</h2>
                <div className="grid grid-cols-2 gap-4">
                  {data.executives.map((exec, idx) => (
                    <div key={idx} className="flex flex-col items-center text-center p-2 border border-neutral-50 rounded-xl">
                      <img src={exec.avatarUrl} alt={exec.name} className="w-16 h-16 rounded-full object-cover shadow border" />
                      <span className="block font-bold text-neutral-800 text-xs mt-2 line-clamp-1">{exec.name}</span>
                      <span className="block text-[10px] uppercase font-semibold text-neutral-400 tracking-wider mt-0.5">{exec.role}</span>
                    </div>
                  ))}
                </div>
              </div>
              <span className="text-xs text-neutral-400 font-medium">Page 3</span>
            </div>

            {/* PAGE 5: MEMORIES IMAGE COLLAGE */}
            <div className="bg-white p-12 flex flex-col justify-between border-r border-neutral-200">
              <div>
                <h2 className="text-2xl font-black text-neutral-900 border-b pb-2 mb-4">MOMENT SNAPSHOTS</h2>
                <div className="grid grid-cols-2 gap-2">
                  {data.gallery.slice(0, 4).map((src, i) => (
                    <img key={i} src={src} alt="Memory" className="w-full h-24 object-cover rounded-lg shadow-sm border border-neutral-100 hover:scale-105 transition" />
                  ))}
                </div>
              </div>
              <span className="text-xs text-neutral-400 font-medium text-right">Page 4</span>
            </div>

            {/* PAGE 6: OUTRO / EXTERNAL SHARE ROUTER */}
            <div className="bg-neutral-950 p-12 flex flex-col items-center justify-between text-center text-white border-l border-neutral-800">
              <div className="my-auto space-y-4">
                <h3 className="text-xl font-bold tracking-tight">THANKS FOR AN INCREMENTAL YEAR!</h3>
                <p className="text-xs text-neutral-400 max-w-xs mx-auto leading-relaxed">Your memories are ready for distribution. Broadcast our shared legacy milestones onto external timelines.</p>
                <button 
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-neutral-900 hover:bg-neutral-100 text-xs font-bold shadow-md transition"
                >
                  🔗 Copy Shareable Link
                </button>
              </div>
              <span className="text-xs text-neutral-600 font-medium">Back Cover</span>
            </div>

          </HTMLFlipBook>
        </div>
      </div>
    </>
  );
}
