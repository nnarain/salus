"use client";

import Modal from './Modal';

interface WaistHeightInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WaistHeightInfoModal({ isOpen, onClose }: WaistHeightInfoModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Waist-to-Height Ratio">
      <div className="space-y-6">
        {/* What it means */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            What is Waist-to-Height Ratio?
          </h3>
          <p className="text-gray-700 dark:text-gray-300">
            The waist-to-height ratio (WHtR) is a simple measure used to assess health risks 
            associated with central obesity. It compares your waist circumference to your height 
            and is considered a better predictor of health risks than BMI alone.
          </p>
        </section>

        {/* How it's calculated */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            How is it Calculated?
          </h3>
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <p className="text-gray-800 dark:text-gray-200 font-mono text-center">
              WHtR = Waist Circumference (cm) ÷ Height (cm)
            </p>
          </div>
          <p className="text-gray-700 dark:text-gray-300 mt-2 text-sm">
            Both measurements should be in the same unit (typically centimeters).
          </p>
        </section>

        {/* Ratio ranges chart */}
        <section>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            What the Ratios Mean
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                &lt; 0.40
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Extremely slim (may indicate underweight)
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                0.40 - 0.49
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Healthy range (low health risk)
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                0.50 - 0.59
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                Increased health risk (take action)
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex-shrink-0 w-24 font-semibold text-gray-900 dark:text-white">
                ≥ 0.60
              </div>
              <div className="flex-1 text-gray-700 dark:text-gray-300">
                High health risk (take action now)
              </div>
            </div>
          </div>
        </section>

        {/* Simple guideline */}
        <section className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
            Simple Guideline
          </h3>
          <p className="text-gray-700 dark:text-gray-300">
            <strong>Keep your waist circumference to less than half your height.</strong>
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            This simple rule applies to adults and children, and is associated with lower risk 
            of cardiovascular disease, diabetes, and other health conditions.
          </p>
        </section>
      </div>
    </Modal>
  );
}
