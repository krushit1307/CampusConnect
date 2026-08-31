import React, { useState, useMemo } from 'react';
import { SiteShell } from '@/components/site/SiteShell';
import { RoommateCompatibilityCard } from '@/components/housing/RoommateCompatibilityCard';
import { PanoramaTourViewer } from '@/components/housing/PanoramaTourViewer';
import {
  LifestyleProfile,
  RoommateCandidate,
  HousingSubletListing,
} from '@/types/housing';
import { calculateRoommateCompatibility } from '@/lib/housing/compatibility';
import {
  Home,
  Users,
  Search,
  Filter,
  Sparkles,
  MapPin,
  Bed,
  Bath,
  CheckCircle,
  Sliders,
  DollarSign,
} from 'lucide-react';

export default function CampusHousingPage() {
  const [activeTab, setActiveTab] = useState<'roommates' | 'sublets'>('roommates');

  // Current user's lifestyle survey profile
  const [myLifestyle, setMyLifestyle] = useState<LifestyleProfile>({
    sleepSchedule: 'night_owl',
    cleanlinessLevel: 4,
    noiseTolerance: 3,
    guestFrequency: 'weekends_only',
    studyHabits: 'at_home',
    petFriendly: true,
    budgetMax: 900,
  });

  const [candidates] = useState<RoommateCandidate[]>([
    {
      id: 'c-1',
      name: 'Maya Chen',
      major: 'B.S. Cognitive Science',
      gradYear: 2026,
      bio: 'Looking for a quiet, clean roommate for a 2B2B near North Campus. I love cooking and keeping common areas tidy!',
      lifestyle: {
        sleepSchedule: 'night_owl',
        cleanlinessLevel: 4,
        noiseTolerance: 3,
        guestFrequency: 'weekends_only',
        studyHabits: 'at_home',
        petFriendly: true,
        budgetMax: 950,
      },
    },
    {
      id: 'c-2',
      name: 'David Patel',
      major: 'B.S. Computer Engineering',
      gradYear: 2027,
      bio: 'Early riser who hits the gym at 6 AM. Focused on school during the week, relaxed on weekends.',
      lifestyle: {
        sleepSchedule: 'early_bird',
        cleanlinessLevel: 5,
        noiseTolerance: 2,
        guestFrequency: 'rarely',
        studyHabits: 'library',
        petFriendly: false,
        budgetMax: 850,
      },
    },
    {
      id: 'c-3',
      name: 'Sarah Kim',
      major: 'B.A. Architecture',
      gradYear: 2025,
      bio: 'Senior working on my thesis model. Flexible schedule, cat lover, looking for a roommate who enjoys art & coffee.',
      lifestyle: {
        sleepSchedule: 'flexible',
        cleanlinessLevel: 4,
        noiseTolerance: 4,
        guestFrequency: 'weekends_only',
        studyHabits: 'mixed',
        petFriendly: true,
        budgetMax: 900,
      },
    },
  ]);

  const [sublets] = useState<HousingSubletListing[]>([
    {
      id: 'sub-1',
      title: 'Master Bedroom in Modern 2B2B (Furnished + Balcony)',
      address: '420 College Avenue, Apt 3B',
      distanceToCampusMiles: 0.3,
      monthlyRent: 850,
      availableTerm: 'Spring / Summer 2027',
      bedrooms: 2,
      bathrooms: 2,
      utilitiesIncluded: true,
      amenities: ['In-unit Washer/Dryer', 'Gigabit Fiber', 'Gym', 'Rooftop Lounge'],
      panoramaImageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&auto=format&fit=crop&q=80',
      images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&auto=format&fit=crop&q=60'],
      landlordOrSubletter: 'Marcus Thorne',
      isVerified: true,
    },
    {
      id: 'sub-2',
      title: 'Private Studio Sublet near Engineering Quad',
      address: '112 University Blvd',
      distanceToCampusMiles: 0.5,
      monthlyRent: 780,
      availableTerm: 'Full Academic Year',
      bedrooms: 1,
      bathrooms: 1,
      utilitiesIncluded: false,
      amenities: ['Dishwasher', 'Bike Storage', 'Air Conditioning'],
      panoramaImageUrl: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&auto=format&fit=crop&q=80',
      images: ['https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&auto=format&fit=crop&q=60'],
      landlordOrSubletter: 'Elena Vance',
      isVerified: true,
    },
  ]);

  // Compute live compatibility scores
  const scoredCandidates = useMemo(() => {
    return candidates
      .map((c) => {
        const { score, highlights } = calculateRoommateCompatibility(myLifestyle, c.lifestyle);
        return {
          ...c,
          compatibilityScore: score,
          compatibilityHighlights: highlights,
        };
      })
      .sort((a, b) => (b.compatibilityScore || 0) - (a.compatibilityScore || 0));
  }, [myLifestyle, candidates]);

  return (
    <SiteShell>
      <div className="min-h-screen bg-[#faf8f5] py-8 px-4 md:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-6 border-b-4 border-black pb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-lime border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  <Home size={24} />
                </span>
                <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight text-black">
                  Campus Housing & Roommate Finder
                </h1>
              </div>
              <p className="font-mono text-sm text-gray-600 mt-1">
                Multi-factor lifestyle compatibility scoring & 360° virtual room tours.
              </p>
            </div>

            {/* View Switcher */}
            <div className="neu-border bg-white p-1.5 flex items-center gap-2">
              <button
                onClick={() => setActiveTab('roommates')}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === 'roommates'
                    ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Users size={16} /> Roommate Matches ({scoredCandidates.length})
              </button>
              <button
                onClick={() => setActiveTab('sublets')}
                className={`flex items-center gap-2 px-4 py-2 font-mono text-xs font-bold uppercase transition-all ${
                  activeTab === 'sublets'
                    ? 'bg-lime text-black border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                    : 'text-gray-600 hover:text-black'
                }`}
              >
                <Home size={16} /> Sublets & 360° Tours ({sublets.length})
              </button>
            </div>
          </div>

          {/* Active Tab View */}
          {activeTab === 'roommates' ? (
            <div className="space-y-6">
              {/* Lifestyle Survey Preferences Card */}
              <div className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <h3 className="font-display font-black text-lg text-black flex items-center gap-2">
                    <Sliders size={18} /> Your Lifestyle Preferences
                  </h3>
                  <span className="font-mono text-xs text-emerald-700 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded font-bold">
                    Scoring Weight: Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                  <div>
                    <label className="block text-gray-500 uppercase font-bold mb-1">Sleep Schedule</label>
                    <select
                      value={myLifestyle.sleepSchedule}
                      onChange={(e) => setMyLifestyle({ ...myLifestyle, sleepSchedule: e.target.value as any })}
                      className="w-full p-2 border-2 border-black rounded bg-white font-bold"
                    >
                      <option value="early_bird">Early Bird (6 AM)</option>
                      <option value="night_owl">Night Owl (1 AM+)</option>
                      <option value="flexible">Flexible</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-500 uppercase font-bold mb-1">Cleanliness (1-5)</label>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      value={myLifestyle.cleanlinessLevel}
                      onChange={(e) => setMyLifestyle({ ...myLifestyle, cleanlinessLevel: Number(e.target.value) })}
                      className="w-full accent-black mt-2"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 font-bold">
                      <span>Relaxed</span>
                      <span>Level {myLifestyle.cleanlinessLevel}</span>
                      <span>Meticulous</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-500 uppercase font-bold mb-1">Max Budget ($/mo)</label>
                    <input
                      type="number"
                      step="50"
                      value={myLifestyle.budgetMax}
                      onChange={(e) => setMyLifestyle({ ...myLifestyle, budgetMax: Number(e.target.value) })}
                      className="w-full p-2 border-2 border-black rounded bg-white font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Roommate Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {scoredCandidates.map((candidate) => (
                  <RoommateCompatibilityCard
                    key={candidate.id}
                    candidate={candidate}
                    onContactClick={(c) => alert(`Connecting with ${c.name}...`)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {sublets.map((sublet) => (
                <div
                  key={sublet.id}
                  className="bg-white border-2 border-black rounded-lg p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] grid grid-cols-1 lg:grid-cols-2 gap-6"
                >
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 bg-lime border border-black rounded">
                          {sublet.availableTerm}
                        </span>
                        <span className="font-mono text-xs text-gray-500 flex items-center gap-1">
                          <MapPin size={12} /> {sublet.distanceToCampusMiles} mi to campus
                        </span>
                      </div>
                      <h3 className="font-display font-black text-2xl text-black">
                        {sublet.title}
                      </h3>
                      <p className="font-mono text-xs text-gray-600">{sublet.address}</p>
                    </div>

                    <div className="flex items-center gap-4 font-mono text-sm">
                      <span className="font-display font-black text-2xl text-black">
                        ${sublet.monthlyRent}<span className="text-xs font-normal text-gray-500">/mo</span>
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="flex items-center gap-1"><Bed size={16} /> {sublet.bedrooms} Bed</span>
                      <span className="flex items-center gap-1"><Bath size={16} /> {sublet.bathrooms} Bath</span>
                    </div>

                    <div>
                      <div className="font-mono text-xs font-bold uppercase text-gray-500 mb-1.5">Amenities Included</div>
                      <div className="flex flex-wrap gap-1.5">
                        {sublet.amenities.map((a) => (
                          <span key={a} className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono text-xs">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => alert(`Inquiring about sublet: ${sublet.title}`)}
                        className="neu-border bg-lime hover:bg-lime/90 px-5 py-2.5 font-mono text-xs font-black uppercase text-black"
                      >
                        Request Lease Co-Signing
                      </button>
                    </div>
                  </div>

                  {/* 360 Panorama Tour */}
                  <div>
                    {sublet.panoramaImageUrl && (
                      <PanoramaTourViewer
                        imageUrl={sublet.panoramaImageUrl}
                        roomTitle={sublet.title}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SiteShell>
  );
}
