import { Link } from "react-router-dom";

export default function LandingPage() {

  const features = [
    {
      title: "Secure Reporting",
      desc: "Submit incidents safely with optional anonymous reporting.",
    },
    {
      title: "Location Tagging",
      desc: "Attach precise map coordinates to incidents.",
    },
    {
      title: "Smart Routing",
      desc: "Reports are automatically sent to the correct department.",
    },
    {
      title: "Real-time Tracking",
      desc: "Track your report from submission to resolution.",
    },
    {
      title: "Direct Communication",
      desc: "Chat with the authority handling your report.",
    },
    {
      title: "Evidence Upload",
      desc: "Upload photos or files as supporting evidence.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">

      {/* NAVBAR */}

      <nav className="border-b border-slate-800">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* LOGO */}

          <div className="flex items-center gap-3">

            <svg viewBox="0 0 28 28" fill="none" className="w-7 h-7">
              <path d="M14 2L4 7v6c0 7.5 4.3 12.3 10 14 5.7-1.7 10-6.5 10-14V7L14 2z" fill="url(#shield-grad)" />
              <path d="M14 6l6 3.2v4.3c0 5.1-2.6 8.5-6 9.8V6z" fill="rgba(255,255,255,0.15)" />
              <path d="M12 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <defs>
                <linearGradient id="shield-grad" x1="4" y1="2" x2="24" y2="28">
                  <stop stopColor="#818cf8" />
                  <stop offset="1" stopColor="#6366f1" />
                </linearGradient>
              </defs>
            </svg>

            <h1 className="text-xl font-semibold">CivicShield</h1>

          </div>

          <div className="flex items-center gap-4">

            <Link
              to="/login"
              className="text-sm text-slate-400 hover:text-white"
            >
              Sign In
            </Link>

            <Link
              to="/register"
              className="bg-slate-800 px-4 py-2 rounded text-sm hover:bg-slate-700"
            >
              Get Started
            </Link>

          </div>

        </div>
      </nav>

      {/* HERO */}

      <section className="max-w-screen-xl mx-auto px-6 py-24 text-center">

        <h1 className="text-5xl md:text-6xl font-bold mb-6">
          Report and Track Civic Issues
        </h1>

        <p className="text-slate-400 max-w-xl mx-auto mb-10">
          CivicShield allows citizens to report public issues such as road damage,
          sanitation problems, or safety hazards and track how authorities respond.
        </p>

        <div className="flex justify-center gap-4">

          <Link
            to="/register"
            className="bg-slate-800 px-6 py-3 rounded hover:bg-slate-700"
          >
            File a Report
          </Link>

          <Link
            to="/login"
            className="border border-slate-700 px-6 py-3 rounded hover:bg-slate-800"
          >
            Sign In
          </Link>

        </div>

        {/* STATS */}

        <div className="mt-16 grid grid-cols-3 gap-8 max-w-md mx-auto">

          <div>
            <p className="text-3xl font-semibold">10K+</p>
            <p className="text-slate-500 text-sm">Reports Filed</p>
          </div>

          <div>
            <p className="text-3xl font-semibold">95%</p>
            <p className="text-slate-500 text-sm">Resolution Rate</p>
          </div>

          <div>
            <p className="text-3xl font-semibold">24/7</p>
            <p className="text-slate-500 text-sm">Platform Availability</p>
          </div>

        </div>

      </section>

      {/* FEATURES */}

      <section className="max-w-screen-xl mx-auto px-6 py-20">

        <div className="text-center mb-12">
          <h2 className="text-3xl font-semibold mb-3">Platform Features</h2>
          <p className="text-slate-400">
            Tools designed for transparent civic reporting.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

          {features.map((f) => (
            <div
              key={f.title}
              className="border border-slate-800 p-6 rounded-lg hover:border-slate-600 transition"
            >
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}

        </div>

      </section>

      {/* HOW IT WORKS */}

      <section className="border-y border-slate-800 py-20">

        <div className="max-w-screen-xl mx-auto px-6">

          <h2 className="text-3xl font-semibold text-center mb-12">
            How It Works
          </h2>

          <div className="grid md:grid-cols-4 gap-8 text-center">

            {[
              {
                step: "01",
                title: "Create Account",
                desc: "Register as a citizen or authority.",
              },
              {
                step: "02",
                title: "Submit Report",
                desc: "Describe the incident and upload evidence.",
              },
              {
                step: "03",
                title: "Department Review",
                desc: "The report is routed to the right authority.",
              },
              {
                step: "04",
                title: "Resolution",
                desc: "Track progress until the issue is resolved.",
              },
            ].map((item) => (
              <div key={item.step}>

                <div className="text-xl font-semibold mb-3">
                  {item.step}
                </div>

                <h3 className="font-semibold mb-2">{item.title}</h3>

                <p className="text-sm text-slate-400">{item.desc}</p>

              </div>
            ))}

          </div>

        </div>

      </section>

      {/* CTA */}

      <section className="max-w-screen-xl mx-auto px-6 py-20 text-center">

        <h2 className="text-3xl font-semibold mb-4">
          Help Improve Your Community
        </h2>

        <p className="text-slate-400 mb-8 max-w-lg mx-auto">
          Join CivicShield today and help make your city safer and more responsive.
        </p>

        <Link
          to="/register"
          className="bg-slate-800 px-8 py-3 rounded hover:bg-slate-700"
        >
          Create Free Account
        </Link>

      </section>

      {/* FOOTER */}

      <footer className="border-t border-slate-800 py-8 text-center text-sm text-slate-500">
        © 2025 CivicShield
      </footer>

    </div>
  );
}
