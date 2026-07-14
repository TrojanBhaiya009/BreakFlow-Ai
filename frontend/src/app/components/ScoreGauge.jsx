'use client';

export default function ScoreGauge({ score, size = 160 }) {
  const radius = (size / 2) - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - (score || 0) / 100);
  const color = getScoreColor(score);
  const grade = getGrade(score);

  return (
    <div className="score-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle className="score-gauge-track" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="score-gauge-fill"
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="score-gauge-value">
        <div className="score-number" style={{ color }}>{score ?? '\u2014'}</div>
        <div className="score-label">{score !== null ? grade : ''}</div>
      </div>
    </div>
  );
}

export function getScoreColor(score) {
  if (score == null) return 'var(--muted)';
  if (score >= 80) return 'var(--color-success)';
  if (score >= 60) return 'var(--color-warning)';
  if (score >= 40) return 'var(--ember)';
  return 'var(--crimson)';
}

export function getGrade(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D+';
  if (score >= 45) return 'D';
  if (score >= 40) return 'D-';
  return 'F';
}
