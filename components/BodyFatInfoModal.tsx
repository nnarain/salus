"use client";

import Modal from './Modal';

interface BodyFatInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BodyFatInfoModal({ isOpen, onClose }: BodyFatInfoModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Body Fat Percentage">
      <div className="space-y-6">
        {/* What it is */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            What is Body Fat Percentage?
          </h3>
          <p className="text-gray-700 dark:text-gray-300">
            Body fat percentage is the proportion of your body weight that is fat tissue compared to lean mass (muscle, bone, organs, and water). 
            Unlike BMI, which only considers height and weight, body fat percentage provides a more accurate picture of your body composition and overall health.
          </p>
        </section>

        {/* Ranges for Men */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Body Fat Ranges - Men
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                2-5%
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Essential fat (minimum needed)
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                6-13%
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Athletic
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                14-17%
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Fitness
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                18-24%
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Average/Acceptable
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                25%+
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Obese
              </div>
            </div>
          </div>
        </section>

        {/* Ranges for Women */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Body Fat Ranges - Women
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                10-13%
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Essential fat (minimum needed)
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                14-20%
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Athletic
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                21-24%
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Fitness
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                25-31%
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Average/Acceptable
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                32%+
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Obese
              </div>
            </div>
          </div>
        </section>

        {/* How to measure */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            How to Measure Body Fat at Home
          </h3>
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                1. Skinfold Calipers (Most Accurate Home Method)
              </h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                Body fat calipers measure the thickness of skinfolds at specific body sites. The most common methods use 3, 4, or 7 measurement sites.
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 text-sm space-y-1">
                <li>Cost: $5-20 for basic calipers</li>
                <li>Accuracy: ±3-5% when done correctly</li>
                <li>Common measurement sites: chest, abdomen, thigh, tricep, suprailiac</li>
                <li>Use online calculators (Jackson-Pollock formula) to convert measurements to body fat %</li>
              </ul>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                2. Bioelectrical Impedance Scales
              </h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                Smart scales send a small electrical current through your body to estimate body composition.
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 text-sm space-y-1">
                <li>Cost: $30-100 for home scales</li>
                <li>Accuracy: Can vary ±5-8% based on hydration</li>
                <li>Best used for tracking trends rather than absolute values</li>
                <li>Measure at the same time of day for consistency</li>
              </ul>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                3. Circumference Measurements (US Navy Method)
              </h4>
              <p className="text-gray-700 dark:text-gray-300 text-sm mb-2">
                Uses measurements of neck, waist, and (for women) hips with height to estimate body fat.
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 text-sm space-y-1">
                <li>Cost: Free (just need a measuring tape)</li>
                <li>Accuracy: ±4-6%</li>
                <li>Use online US Navy body fat calculator</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Tips */}
        <section className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
            Measurement Tips
          </h3>
          <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 text-sm space-y-1">
            <li>Take measurements at the same time of day for consistency</li>
            <li>Measure before eating or drinking for more accurate results</li>
            <li>Track trends over time rather than focusing on single measurements</li>
            <li>Body fat percentage naturally fluctuates, so measure weekly or biweekly</li>
            <li>Combine multiple methods for a more complete picture</li>
          </ul>
        </section>
      </div>
    </Modal>
  );
}
