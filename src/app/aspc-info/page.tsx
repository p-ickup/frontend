'use client'

import { useState } from 'react'
import {
  ExternalLink,
  ArrowLeft,
  Info,
  HelpCircle,
  FileText,
  MessageSquare,
} from 'lucide-react'
import RedirectButton from '@/components/buttons/RedirectButton'

interface ASPCLink {
  title: string
  description: string
  url: string
  icon: any
  color: string
  isInternal: boolean
}

export default function ASPCInfoPage() {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null)

  const aspcLinks: ASPCLink[] = [
    {
      title: 'Quick Guide',
      description: 'Essential information for using ASPC RideLink',
      url: 'https://docs.google.com/document/d/e/2PACX-1vSEkEcvV6-2Fq9bb_F8-wqLrAAPi3fSBSCIGddqMlz2Zcdy6Z6AtDNBWU1cTEK7CbjnWW7anKUWrNY0/pub',
      icon: Info,
      color: 'bg-blue-500',
      isInternal: false,
    },
    {
      title: 'Frequently Asked Questions',
      description: 'Common questions and answers about the rideshare program',
      url: 'https://nam10.safelinks.protection.outlook.com/?url=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2Fe%2F2PACX-1vQCaNGg8mk5Pq7zqTLnz0lH7gZ7iI9mrEPdh3_LqpjpsgObauHmuow7ltqlrPPd--EEa2jDKffhZpXI%2Fpub&data=05%7C02%7Cjljz2022%40mymail.pomona.edu%7C50c1d711755241b1d90908ddfae05489%7C817f590439044ee8b3a5a65d4746ff70%7C0%7C0%7C638942563626043986%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&sdata=QefDaOTdSzIlUBAGv%2BSSgaXvTyyCm5q6rZ3GSnI0IwQ%3D&reserved=0',
      icon: HelpCircle,
      color: 'bg-green-500',
      isInternal: false,
    },
    {
      title: 'Program Policies',
      description: 'Official policies and guidelines for ASPC RideLink',
      url: 'https://nam10.safelinks.protection.outlook.com/?url=https%3A%2F%2Fdocs.google.com%2Fdocument%2Fd%2Fe%2F2PACX-1vSnd4UeEvul3M6_L5rPr3z1Shzlccuqa0aP-O5eifF7p_BIzfc-lKrNwAG95lCb4LnOWDeZ-Zz2YRa9%2Fpub&data=05%7C02%7Cjljz2022%40mymail.pomona.edu%7C50c1d711755241b1d90908ddfae05489%7C817f590439044ee8b3a5a65d4746ff70%7C0%7C0%7C638942563626080129%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&sdata=AjkV%2BM0VA9lvyyIxGxI9%2Bnd5s8BKGrG3yOJJBxY3teY%3D&reserved=0',
      icon: FileText,
      color: 'bg-purple-500',
      isInternal: false,
    },
    {
      title: 'Delay Verification Form',
      description:
        'Required if you arrived late and had to be regrouped or used a contingency voucher',
      url: 'https://nam10.safelinks.protection.outlook.com/?url=https%3A%2F%2Fdocs.google.com%2Fforms%2Fd%2Fe%2F1FAIpQLSfmAK5eeJK1Z-zgH-5f3YLpD4sywjpsjYZwgiZPGlis5a-04A%2Fviewform%3Fusp%3Dheader&data=05%7C02%7Cjljz2022%40mymail.pomona.edu%7C50c1d711755241b1d90908ddfae05489%7C817f590439044ee8b3a5a65d4746ff70%7C0%7C0%7C638942563626061093%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&sdata=5bdAVhz3iu9YStgPNvKjEqLRB0wGEamZSfoD4xWEaYk%3D&reserved=0',
      icon: FileText,
      color: 'bg-orange-500',
      isInternal: false,
    },
    {
      title: 'Comments, Concerns & Feedback',
      description: 'Share your experience or report issues directly to ASPC',
      url: 'https://nam10.safelinks.protection.outlook.com/?url=https%3A%2F%2Fdocs.google.com%2Fforms%2Fd%2Fe%2F1FAIpQLSdQIA8K23k7M6O9X3KDQYHmM5GovKikVftZIV5m2QDqUFr2aA%2Fviewform%3Fusp%3Dheader&data=05%7C02%7Cjljz2022%40mymail.pomona.edu%7C50c1d711755241b1d90908ddfae05489%7C817f590439044ee8b3a5a65d4746ff70%7C0%7C0%7C638942563626096897%7CUnknown%7CTWFpbGZsb3d8eyJFbXB0eU1hcGkiOnRydWUsIlYiOiIwLjAuMDAwMCIsIlAiOiJXaW4zMiIsIkFOIjoiTWFpbCIsIldUIjoyfQ%3D%3D%7C0%7C%7C%7C&sdata=oQ7n8K5rUcvoD9BVd1n5dagWKQbOFI1nm3a1nHmizjY%3D&reserved=0',
      icon: MessageSquare,
      color: 'bg-teal-500',
      isInternal: false,
    },
  ]

  const handleLinkClick = (url: string, isInternal: boolean = false) => {
    if (isInternal) {
      window.location.href = url
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        <div className="absolute left-1/4 top-20 h-16 w-16 rotate-12 rounded-2xl bg-gradient-to-br from-teal-400/20 to-teal-600/20"></div>
        <div className="absolute right-1/3 top-40 h-12 w-12 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20"></div>
        <div className="absolute bottom-40 left-1/3 h-20 w-20 rotate-45 rounded-3xl bg-gradient-to-br from-indigo-400/20 to-indigo-600/20"></div>
      </div>

      <div className="relative mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="mb-4 flex items-center gap-4"></div>

          <div className="text-center">
            <h1 className="mb-2 text-4xl font-bold text-gray-800">
              ASPC RideLink
            </h1>
            <p className="mb-4 text-lg text-gray-600">
              Information & Resources for Pomona College Students
            </p>
            <div className="mx-auto max-w-2xl rounded-lg border border-teal-200 bg-gradient-to-br from-teal-50 to-blue-50 p-6 shadow-md">
              <div className="mb-4 rounded-lg bg-white/70 p-4 backdrop-blur-sm">
                <p className="text-base font-bold text-teal-900">
                  Need day-of-travel RideLink support?
                </p>
                <p className="mt-2 text-lg font-bold text-teal-800">
                  Call/text:{' '}
                  <a
                    href="tel:9093475295"
                    className="text-xl text-teal-700 underline transition-colors hover:text-teal-900"
                  >
                    909-347-5295
                  </a>
                </p>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-700">
                  <strong className="text-gray-800">Email:</strong>{' '}
                  <a
                    href="mailto:ridelink@aspc.pomona.edu"
                    className="text-blue-700 hover:underline"
                  >
                    ridelink@aspc.pomona.edu
                  </a>
                </p>
                <p className="text-gray-600">
                  For questions about ASPC&apos;s RideLink Program
                </p>
                <p className="border-t border-gray-300 pt-3 text-gray-700">
                  View our{' '}
                  <a
                    href="https://docs.google.com/document/d/e/2PACX-1vTUgsgoxR1HOkfnW4QYfki4DXLUSB-ELyyMqFNFfOSgxyshPE9ykZyBODVxTCip10ULXgeaqrBXGddA/pub"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-teal-700 underline hover:text-teal-900"
                  >
                    Privacy Policy
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Subsidy Policy Box */}
        <div className="mb-8">
          <div
            className="hover:shadow-3xl transform cursor-pointer rounded-2xl border-2 border-teal-300/30 bg-gradient-to-br from-teal-400/20 to-teal-600/20 shadow-2xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1"
            onClick={() => handleLinkClick('/aspc-policy', true)}
            onMouseEnter={() => setHoveredLink('Subsidy Policy')}
            onMouseLeave={() => setHoveredLink(null)}
          >
            <div className="p-8 text-gray-800">
              <div className="mb-4 flex items-center gap-4">
                <div className="rounded-xl bg-teal-500/20 p-4 backdrop-blur-sm">
                  <FileText className="h-8 w-8 text-teal-700" />
                </div>
                <div>
                  <h3 className="mb-1 text-2xl font-bold text-gray-800">
                    Subsidy Policy
                  </h3>
                  <p className="text-lg text-gray-600">
                    PICKUP-specific subsidy information and guidelines
                  </p>
                </div>
              </div>
              {hoveredLink === 'Subsidy Policy' && (
                <div className="mt-4 border-t border-gray-300/30 pt-4">
                  <p className="text-sm text-gray-600">
                    Click to view PICKUP subsidy policy
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Links Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {aspcLinks.map((link, index) => {
            const IconComponent = link.icon
            return (
              <div
                key={index}
                className="transform cursor-pointer rounded-xl border border-gray-100 bg-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                onClick={() => handleLinkClick(link.url, link.isInternal)}
                onMouseEnter={() => setHoveredLink(link.title)}
                onMouseLeave={() => setHoveredLink(null)}
              >
                <div className="p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={`rounded-lg p-3 ${link.color} flex-shrink-0 text-white`}
                    >
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-gray-800">
                        {link.title}
                        {!link.isInternal && (
                          <ExternalLink className="h-4 w-4 flex-shrink-0 text-gray-400" />
                        )}
                      </h3>
                      <p className="text-sm leading-relaxed text-gray-600">
                        {link.description}
                      </p>
                    </div>
                  </div>

                  {hoveredLink === link.title && (
                    <div className="mt-4 border-t border-gray-100 pt-4">
                      <p className="text-xs text-gray-500">
                        {link.isInternal
                          ? 'Click to navigate'
                          : 'Click to open in new tab'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Important Notes */}
        <div className="mt-12 rounded-xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm">
          <h3 className="mb-3 text-lg font-semibold text-gray-800">
            Important Information
          </h3>
          <ul className="space-y-3 text-sm text-gray-700">
            <li className="flex items-start gap-3">
              <span className="mt-1 font-bold text-teal-600">•</span>
              <span>
                <strong className="text-gray-800">Pickup Location:</strong> 647
                College Way (in front of Lincoln Hall east entrance)
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 font-bold text-teal-600">•</span>
              <span>
                <strong className="text-gray-800">Uber Vouchers:</strong>{' '}
                Geofenced to only allow pickup within 250 ft of the designated
                location
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 font-bold text-teal-600">•</span>
              <span>
                <strong className="text-gray-800">Safety:</strong> For
                emergencies, call 911 (off-campus) or Campus Safety at (909)
                607-2000 (on-campus)
              </span>
            </li>
          </ul>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            This page provides quick access to ASPC&apos;s official RideLink
            resources.
            <br />
            All links open in new tabs for your convenience.
          </p>
        </div>
      </div>
    </div>
  )
}
