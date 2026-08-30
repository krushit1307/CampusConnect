import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getCourseProgress,
  completeModule,
  completeCourse,
  getCourseModule,
  getAllCourseModules,
  RemediationCourse,
  CourseModule,
} from '@/lib/security/remediationCourseService';
import { checkIfAccountSuspended } from '@/lib/security/accountSuspensionService';

export default function RemediationCourseView() {
  const { user } = useAuth();
  const [course, setCourse] = useState<RemediationCourse | null>(null);
  const [currentModule, setCurrentModule] = useState<CourseModule | null>(null);
  const [allModules, setAllModules] = useState<CourseModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [suspension, setSuspension] = useState<any>(null);

  useEffect(() => {
    loadCourse();
  }, [user]);

  async function loadCourse() {
    try {
      setLoading(true);

      // Get course progress
      if (user?.id) {
        const progress = await getCourseProgress(user.id);
        if (progress) {
          setCourse(progress);

          // Get current module
          const module = getCourseModule(progress.currentModule);
          setCurrentModule(module);

          // Load all modules
          setAllModules(getAllCourseModules());
        }

        // Check suspension
        const { isSuspended, suspension: susp } = await checkIfAccountSuspended(user.id);
        if (isSuspended && susp) {
          setSuspension(susp);
        }
      }
    } catch (err) {
      console.error('Failed to load course:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleModuleComplete() {
    if (!course) return;

    try {
      setSubmitting(true);

      // Check quiz answers
      if (currentModule?.quizQuestions) {
        let correct = 0;
        for (const question of currentModule.quizQuestions) {
          if (quizAnswers[question.id] === question.correctAnswer) {
            correct++;
          }
        }
        const score = Math.round((correct / currentModule.quizQuestions.length) * 100);
        setQuizScore(score);

        // Require 80% to pass
        if (score < 80) {
          setQuizSubmitted(true);
          setSubmitting(false);
          return;
        }
      }

      // Complete module
      await completeModule(course.id, currentModule?.id || 0);

      // If last module, complete course
      if (currentModule?.id === allModules.length) {
        await completeCourse(course.id, user!.id);
        // Reload page to show completion
        window.location.reload();
      } else {
        // Load next module
        const nextModule = getCourseModule((currentModule?.id || 0) + 1);
        setCurrentModule(nextModule);
        setQuizAnswers({});
        setQuizSubmitted(false);
        setQuizScore(0);

        // Refresh course
        loadCourse();
      }
    } catch (err) {
      console.error('Failed to complete module:', err);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading course...</p>
        </div>
      </div>
    );
  }

  if (!course || !currentModule) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Course not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Suspension Notice */}
        {suspension && (
          <div className="bg-red-50 border-l-4 border-red-600 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  <strong>Account Suspended:</strong> Complete this training course to restore access. Your account will be unsuspended after successful completion.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Cybersecurity Training</h1>
          <p className="text-gray-600">Module {currentModule.id} of {allModules.length}</p>

          {/* Progress Bar */}
          <div className="mt-4 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(course.modulesCompleted / allModules.length) * 100}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {course.modulesCompleted} of {allModules.length} modules completed
          </p>
        </div>

        {/* Module Content */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">{currentModule.title}</h2>
          <p className="text-gray-600 mb-6">{currentModule.description}</p>

          {/* Video */}
          {currentModule.videoUrl && (
            <div className="mb-6 rounded-lg overflow-hidden bg-gray-900 aspect-video mb-6">
              <iframe
                src={currentModule.videoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* Module Text */}
          <div className="prose prose-sm max-w-none mb-8 bg-gray-50 p-6 rounded">
            <pre className="whitespace-pre-wrap font-sans text-gray-700">{currentModule.content}</pre>
          </div>

          {/* Quiz Section */}
          {currentModule.quizQuestions.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Knowledge Check</h3>

              {quizSubmitted ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <p className="text-lg font-semibold text-blue-900 mb-2">
                    Score: {quizScore}%
                  </p>
                  {quizScore < 80 ? (
                    <p className="text-blue-800">
                      Please review the material and try again. You need 80% to pass.
                    </p>
                  ) : (
                    <p className="text-green-800">
                      Great job! You passed. Click continue to move to the next module.
                    </p>
                  )}
                </div>
              ) : null}

              <div className="space-y-6">
                {currentModule.quizQuestions.map((question) => (
                  <div key={question.id} className="border rounded-lg p-4">
                    <p className="font-medium text-gray-800 mb-3">{question.question}</p>
                    <div className="space-y-2">
                      {question.options.map((option, index) => (
                        <label key={index} className="flex items-center">
                          <input
                            type="radio"
                            name={question.id}
                            value={index}
                            checked={quizAnswers[question.id] === index}
                            onChange={() =>
                              setQuizAnswers({ ...quizAnswers, [question.id]: index })
                            }
                            disabled={quizSubmitted}
                            className="mr-3"
                          />
                          <span className="text-gray-700">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between">
          <button
            onClick={() => {
              if (currentModule.id > 1) {
                const prevModule = getCourseModule(currentModule.id - 1);
                setCurrentModule(prevModule);
                setQuizAnswers({});
                setQuizSubmitted(false);
              }
            }}
            disabled={currentModule.id === 1 || submitting}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            ← Previous Module
          </button>

          <button
            onClick={handleModuleComplete}
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {submitting ? 'Processing...' : currentModule.id === allModules.length ? 'Complete Course' : 'Next Module →'}
          </button>
        </div>

        {/* Estimated Time */}
        <div className="mt-6 text-center text-sm text-gray-600">
          ⏱️ Estimated time for this module: {currentModule.estimatedDuration} minutes
        </div>
      </div>
    </div>
  );
}