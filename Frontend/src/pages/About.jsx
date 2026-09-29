import BrandStrip from '../components/BrandStrip.jsx'

const TEAM = [
  { name: 'Owethu Mbengashe', role: 'Frontend Designer & Developer', photo: '/team/Owethu.jpeg'},
  { name: 'Warwick Williams', role: 'AI Avatar & Video Generation Engineer', photo: '/team/Warwick.jpeg' },
  { name: 'Ruan Nel', role: 'API Integration', photo:'/team/Ruan.jpeg'},
  { name: 'Sibusiso Mlangeni', role: 'DevOps & Infrastructure Engineer', photo:'/team/Sbusiso.jpeg'},
  { name: 'Thato Ndlovu', role: 'Backend API Developer' },
  { name: 'Tsholanang Makgoka', role: '????' },
  { name: 'Ingmar Sjolund', role: '????' },
  { name: 'Ruben Cousins', role: 'AI Chatbot Developer' },
]

function Section({ title, children }) {
  return (
    <div className="mb-12">
      <h2 className="font-display text-2xl text-navy mb-3">{title}</h2>
      <p className="text-ink/80 leading-relaxed">{children}</p>
    </div>
  )
}

export default function About() {
  return (
    <>
      <BrandStrip />

    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1
        className="font-display text-4xl text-teal text-center underline
          decoration-2 underline-offset-8 mt-10 mb-16"
      >
        About us
      </h1>

      <Section title="What are we">
        Project Avatar is an AI Lecturer Synthesis system created by a group
        of students. It is a fully integrated generative AI Learning
        environment that takes material from a lecturer and turns that
        lecturer into an AI clone that can deliver lectures without actually
        being present.
      </Section>

      <Section title="Vision and Mission">
        To develop a secure, self-hosted system that transforms a 30-second
        video sample and a text script into a full-length, lip-synced
        digital lecture with interactive slide support, AI-driven tutoring
        and multilingual support for international use.
      </Section>

      <Section title="Why it exists">
        Project Avatar came from a simple observation: one lecturer can only
        be in one classroom at a time, meanwhile there are plenty of
        students across the world that don't have access to quality
        education. Project Avatar will fill that gap and bring quality
        education to your doorstep, for no cost and in your preferred
        language.
      </Section>

      <div>
        <h2 className="font-display text-2xl text-navy mb-8">
          Meet the team
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-10">
          {TEAM.map((member) => (
            <div key={member.name} className="text-center">
              {member.photo ? (
                <img
                  src={member.photo}
                  alt={member.name}
                  className="w-20 h-20 rounded-full object-cover border border-navy/20 mx-auto mb-3"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-cream border border-navy/20 mx-auto mb-3" />
              )}
              <p className="text-sm font-medium">{member.name}</p>
              {member.role && (
                <p className="text-xs text-ink/60 mt-0.5">{member.role}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
    </>
  )
}
