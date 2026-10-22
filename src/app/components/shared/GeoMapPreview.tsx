import { MapPinned } from 'lucide-react';

type Coordinates = { lat: number; lng: number };

interface GeoMapPreviewProps {
  coordinates: Coordinates | null | undefined;
  title: string;
  description?: string;
  className?: string;
  mapHeightClass?: string;
}

function isValidCoordinate(coordinates: Coordinates | null | undefined): coordinates is Coordinates {
  return Boolean(
    coordinates &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng) &&
    Math.abs(coordinates.lat) <= 90 &&
    Math.abs(coordinates.lng) <= 180,
  );
}

export function GeoMapPreview({ coordinates, title, description, className = '', mapHeightClass = 'h-48' }: GeoMapPreviewProps) {
  if (!isValidCoordinate(coordinates)) {
    return (
      <div className={`rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs text-slate-500 ${className}`}>
        <div className="flex items-center gap-2 font-semibold text-slate-600">
          <MapPinned className="h-4 w-4 text-[#800000]" />
          {title}
        </div>
        <p className="mt-1.5">No GPS coordinates are available for this record.</p>
      </div>
    );
  }

  const { lat, lng } = coordinates;
  const mapUrl = `https://www.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  return (
    <section className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-3 py-2.5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <MapPinned className="h-4 w-4 text-[#800000]" />
            {title}
          </div>
          {description && <p className="mt-0.5 text-[10px] text-slate-500">{description}</p>}
        </div>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[10px] font-bold text-[#800000] underline underline-offset-2"
        >
          Open map
        </a>
      </div>
      <iframe
        title={title}
        src={mapUrl}
        loading="lazy"
        className={`${mapHeightClass} w-full border-0`}
        referrerPolicy="no-referrer"
      />
      <p className="border-t border-slate-100 px-3 py-2 font-mono text-[10px] text-slate-500">
        {lat.toFixed(6)}, {lng.toFixed(6)}
      </p>
    </section>
  );
}
