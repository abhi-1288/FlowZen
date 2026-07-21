"use client";

import Link from "next/link";
import Image from "next/image";
import { FaGithub } from "react-icons/fa";
import { FaXTwitter, FaLinkedin } from "react-icons/fa6";

const productLinks = [
  { label: "Kanban Boards", href: "/board" },
  { label: "Attendance", href: "/profile" },
  { label: "Finance", href: "/profile" },
  { label: "HR Module", href: "/profile" },
  { label: "Recruitment", href: "/recruitment" },
  { label: "Chat", href: "/profile" },
];

const resourceLinks = [
  { label: "Documentation", href: "/docs" },
];

const companyLinks = [
  { label: "Careers", href: "/careers" },
  { label: "GitHub", href: "https://github.com/abhi-1288/FlowZen" },
];

const socialLinks = [
  { label: "GitHub", href: "https://github.com/abhi-1288/FlowZen", icon: FaGithub },
  { label: "Twitter", href: "https://twitter.com", icon: FaXTwitter },
  { label: "LinkedIn", href: "https://linkedin.com", icon: FaLinkedin },
];

export function Footer() {
  return (
    <footer className="border-t border-gray-200 dark:border-[#222] bg-gray-50 dark:bg-[#0a0a0a] relative z-10">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg overflow-hidden relative">
                <Image
                  src="/Logos/logo.jpg"
                  alt="FlowZen Logo"
                  fill
                  className="object-cover"
                />
              </div>
              <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-gray-100">
                FlowZen
              </span>
            </Link>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs leading-relaxed">
              The all-in-one workflow platform for modern teams. Manage boards, attendance, finance, HR, and recruitment in one workspace.
            </p>
            <div className="flex items-center gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg border border-gray-200 dark:border-[#2a2a2a] flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-[#3a3a3a] transition-colors"
                  aria-label={social.label}
                >
                  <social.icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Product
            </h3>
            <ul className="space-y-3">
              {productLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Resources
            </h3>
            <ul className="space-y-3">
              {resourceLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Company
            </h3>
            <ul className="space-y-3">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-gray-200 dark:border-[#222]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            &copy; {new Date().getFullYear()} FlowZen. All rights reserved.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
            Built by
            <a
              href="https://github.com/abhi-1288"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors font-medium"
            >
              Abhijeet
            </a>
            &middot;
            <a
              href="https://portfolio-abhijeet.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors font-medium"
            >
              Portfolio
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
