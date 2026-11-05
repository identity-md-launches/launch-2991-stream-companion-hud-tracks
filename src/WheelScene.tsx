export default function WheelScene({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`wheel-art${spinning ? " is-spinning" : ""}`}
      viewBox="0 0 400 310"
      aria-hidden="true"
    >
      <defs>
        <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0v24" fill="none" stroke="#243139" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="400" height="310" fill="url(#grid)" />
      <path
        d="M25 48h24m-12-12v24M351 48h24m-12-12v24M25 272h24m-12-12v24M351 272h24m-12-12v24"
        stroke="#3e5458"
        fill="none"
      />
      <path
        d="m200 157-61 128h122Z"
        fill="#15272b"
        stroke="#3f6665"
        strokeWidth="1.5"
      />
      <path d="M125 286h150" stroke="#66e2c4" strokeWidth="2" />
      <circle
        cx="200"
        cy="146"
        r="119"
        fill="#101b20"
        stroke="#365650"
        strokeWidth="1.5"
      />
      <circle
        cx="200"
        cy="146"
        r="110"
        fill="none"
        stroke="#66e2c4"
        strokeWidth="2.5"
      />
      <circle
        cx="200"
        cy="146"
        r="99"
        fill="none"
        stroke="#2a4644"
        strokeWidth="1"
      />
      <g className="wheel-spokes" stroke="#40605b" strokeWidth="1.2">
        {Array.from({ length: 16 }, (_, i) => (
          <path
            key={i}
            d="M200 40v30M200 222v30"
            transform={`rotate(${i * 11.25} 200 146)`}
          />
        ))}
        <path d="M200 146V50m0 96 68-68m-68 68h96m-96 0 68 68m-68-68v96m0-96-68 68m68-68h-96m96 0-68-68" />
      </g>
      <circle
        cx="200"
        cy="146"
        r="11"
        fill="#1b3031"
        stroke="#66e2c4"
        strokeWidth="2"
      />
      <circle cx="200" cy="146" r="3" fill="#66e2c4" />
      <g transform="translate(145 161)" shapeRendering="crispEdges">
        <path
          d="M12 42V24h8V8h18v8h23V8h17v22h9v13h8v32h-8v10H17V74H8V48Z"
          fill="#1d2526"
        />
        <path
          d="M20 41V26h7V16h9v13h28V16h10v20h7v10h8v23h-9v8H23V65h-8V47Z"
          fill="#ce9360"
        />
        <path d="M27 37h39v8h13v21h-8v11H31V65h-9V46h5Z" fill="#eabb85" />
        <path d="M35 51h25v9h13v14H31V61h4Z" fill="#f4dbb8" />
        <path d="M27 21h6v11h-6m40-11h5v11h-5" fill="#c47f70" />
        <path d="M58 40h6v7h-6m18 1h7v7h-7" fill="#162025" />
        <path
          d="M70 57h6v5h-6m-5 5h5v5h-5M22 77h20v7H22m37-7h20v7H59"
          fill="#a6714d"
        />
        <path d="M8 52H2v11h11" fill="#eabb85" />
        <path d="M44 30h8v8h-8" fill="#f2d2a5" />
      </g>
      <path
        d="M322 145h31m-4-4 4 4-4 4M47 145h30"
        stroke="#4c7771"
        fill="none"
      />
      <circle cx="357" cy="145" r="3" fill="#66e2c4" />
    </svg>
  );
}
