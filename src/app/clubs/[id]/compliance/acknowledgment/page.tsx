'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const complianceQuestions = [
    {
        id: 'q1',
        question: 'Is it permissible to host an event without prior fire code approval?',
        options: ['Yes, if it is small', 'No, all events require safety compliance', 'Only for indoor events'],
        correct: 'No, all events require safety compliance'
    },
    {
        id: 'q2',
        question: 'Who is responsible for ensuring club funds are used appropriately?',
        options: ['The Student Union only', 'The Club President and Treasurer', 'Any club member'],
        correct: 'The Club President and Treasurer'
    }
];

export default function ComplianceAcknowledgmentPage() {
    const params = useParams();
    const router = useRouter();
    const clubId = params.id as string;

    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleOptionChange = (questionId: string, option: string) => {
        setAnswers(prev => ({ ...prev, [questionId]: option }));
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);

        // Check if all questions are answered
        if (Object.keys(answers).length < complianceQuestions.length) {
            setError('Please answer all compliance questions.');
            setIsSubmitting(false);
            return;
        }

        // Evaluate answers
        const formattedAnswers = complianceQuestions.map(q => ({
            question_id: q.id,
            selected_option: answers[q.id],
            is_correct: answers[q.id] === q.correct
        }));

        const passed = formattedAnswers.every(a => a.is_correct);

        try {
            // Record submission
            await supabase.from('club_compliance_submissions').insert({
                club_id: clubId,
                answers: formattedAnswers,
                passed: passed,
            });

            if (passed) {
                // Update club status to acknowledge compliance (appeals to Student Union)
                await supabase
                    .from('clubs')
                    .update({ compliance_acknowledged: true })
                    .eq('id', clubId);

                alert('Compliance acknowledged successfully. Your appeal has been submitted to the Student Union.');
                router.push(`/clubs/${clubId}/dashboard`);
            } else {
                setError('You did not pass the compliance quiz. Please review the club guidelines and try again.');
            }
        } catch (err) {
            setError('Failed to submit compliance acknowledgment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    Compliance Acknowledgment Quiz
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mb-8">
                    To appeal your club&apos;s probation status, you must correctly answer the following compliance questions.
                </p>

                {error && (
                    <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300">
                        {error}
                    </div>
                )}

                <div className="space-y-8">
                    {complianceQuestions.map((q, index) => (
                        <div key={q.id} className="border-b border-gray-200 dark:border-gray-700 pb-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                {index + 1}. {q.question}
                            </h3>
                            <div className="space-y-3">
                                {q.options.map((option) => (
                                    <label key={option} className="flex items-center space-x-3 cursor-pointer">
                                        <input
                                            type="radio"
                                            name={q.id}
                                            value={option}
                                            checked={answers[q.id] === option}
                                            onChange={() => handleOptionChange(q.id, option)}
                                            className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                                        />
                                        <span className="text-gray-700 dark:text-gray-300">{option}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className={`
              py-3 px-8 rounded-xl font-semibold text-lg transition-all duration-200
              ${isSubmitting
                                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-lg'
                            }
            `}
                    >
                        {isSubmitting ? 'Submitting...' : 'Submit Acknowledgment'}
                    </button>
                </div>
            </div>
        </div>
    );
}
