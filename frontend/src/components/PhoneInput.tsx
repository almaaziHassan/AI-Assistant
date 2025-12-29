import React, { useState, useEffect, useMemo } from 'react';
import { getCountriesWithRules, getCountryByDialCode } from '../utils/validation';

interface PhoneInputProps {
  value: string;
  onChange: (fullPhone: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: string;
  defaultCountryCode?: string;
}

const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  onBlur,
  disabled = false,
  error,
  defaultCountryCode = '+92'
}) => {
  const countries = useMemo(() => getCountriesWithRules(), []);

  // Parse initial value to extract country code and number
  const parsePhoneValue = (phone: string): { countryCode: string; nationalNumber: string } => {
    if (!phone || !phone.startsWith('+')) {
      return { countryCode: defaultCountryCode, nationalNumber: phone || '' };
    }

    // Try to match country code (check 3-digit, 2-digit, then 1-digit)
    const withoutPlus = phone.substring(1);
    for (const codeLength of [3, 2, 1]) {
      const potentialCode = withoutPlus.substring(0, codeLength);
      if (getCountryByDialCode(potentialCode)) {
        return {
          countryCode: '+' + potentialCode,
          nationalNumber: withoutPlus.substring(codeLength)
        };
      }
    }

    return { countryCode: defaultCountryCode, nationalNumber: phone };
  };

  const parsed = parsePhoneValue(value);
  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [nationalNumber, setNationalNumber] = useState(parsed.nationalNumber);

  // Get current country's rules
  const currentCountry = useMemo(() => {
    const dialCode = countryCode.replace('+', '');
    return getCountryByDialCode(dialCode);
  }, [countryCode]);

  // Update parent when country or number changes
  useEffect(() => {
    const digitsOnly = nationalNumber.replace(/\D/g, '');
    if (digitsOnly) {
      onChange(countryCode + digitsOnly);
    } else {
      onChange('');
    }
  }, [countryCode, nationalNumber, onChange]);

  // Sync from parent value changes (e.g., form reset)
  useEffect(() => {
    const newParsed = parsePhoneValue(value);
    if (newParsed.countryCode !== countryCode || newParsed.nationalNumber !== nationalNumber) {
      setCountryCode(newParsed.countryCode);
      setNationalNumber(newParsed.nationalNumber);
    }
  }, [value]);

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCode = e.target.value;
    setCountryCode(newCode);

    // Clear national number when country changes to avoid confusion
    setNationalNumber('');
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value;

    // Only allow digits
    const digitsOnly = input.replace(/\D/g, '');

    // Limit to max length for this country
    const maxLength = currentCountry?.maxLength || 15;
    const limited = digitsOnly.substring(0, maxLength);

    setNationalNumber(limited);
  };

  const handleNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow: backspace, delete, tab, escape, enter, arrows
    const allowedKeys = ['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (allowedKeys.includes(e.key)) {
      return;
    }

    // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if (e.ctrlKey || e.metaKey) {
      return;
    }

    // Block non-digit characters
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
      return;
    }

    // Block if at max length
    const maxLength = currentCountry?.maxLength || 15;
    if (nationalNumber.length >= maxLength) {
      e.preventDefault();
    }
  };

  // Calculate progress for visual feedback
  const minLength = currentCountry?.minLength || 6;
  const maxLength = currentCountry?.maxLength || 15;
  const currentLength = nationalNumber.replace(/\D/g, '').length;
  const isValidLength = currentLength >= minLength && currentLength <= maxLength;

  return (
    <div className="phone-input-container">
      <div className="phone-input-wrapper">
        <select
          className="country-code-select"
          value={countryCode}
          onChange={handleCountryChange}
          disabled={disabled}
        >
          {countries.map((country) => (
            <option key={country.dialCode} value={country.code}>
              {country.code} {country.name}
            </option>
          ))}
        </select>

        <input
          type="tel"
          className="national-number-input"
          value={nationalNumber}
          onChange={handleNumberChange}
          onKeyDown={handleNumberKeyDown}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={currentCountry ? `${currentCountry.minLength} digits` : 'Phone number'}
          maxLength={maxLength}
        />
      </div>

      <div className="phone-input-hint">
        {currentCountry && (
          <span className={`digit-counter ${isValidLength ? 'valid' : currentLength > 0 ? 'invalid' : ''}`}>
            {currentLength}/{minLength === maxLength ? minLength : `${minLength}-${maxLength}`} digits
          </span>
        )}
        {currentCountry && (
          <span className="example-hint">
            e.g., {currentCountry.example.replace(currentCountry.code + ' ', '')}
          </span>
        )}
      </div>

      {error && <div className="field-error">{error}</div>}
    </div>
  );
};

export default PhoneInput;
