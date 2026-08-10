import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import * as zxcvbnEnPackage from "@zxcvbn-ts/language-en";

const zxcvbn = new ZxcvbnFactory({
  translations: zxcvbnEnPackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
});

export function getPasswordStrength(password: string, userInputs: string[] = []) {
  return zxcvbn.check(password, userInputs);
}

type Props = {
  password: string;
  userInputs?: string[];
};

export function PasswordStrengthMeter({ password, userInputs = [] }: Props) {
  if (!password) return null;

  const result = getPasswordStrength(password, userInputs);

  const colors = ["bg-destructive", "bg-orange-500", "bg-yellow-500", "bg-green-600"];

  const labels = ["Very Weak", "Weak", "Good", "Strong", "Very Strong"];

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 border border-black ${
              i <= result.score ? colors[result.score] : "bg-transparent"
            }`}
          />
        ))}
      </div>

      <p className="mt-1 font-mono text-xs font-bold uppercase">{labels[result.score]}</p>

      {result.feedback.warning && <p className="mt-1 text-xs">{result.feedback.warning}</p>}

      {result.feedback.suggestions.length > 0 && (
        <ul className="mt-1 list-disc pl-4 text-xs">
          {result.feedback.suggestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
