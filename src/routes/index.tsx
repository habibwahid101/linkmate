import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { BookingSheet } from "@/components/booking-sheet";
import { LEVELS, STANDARD_ID_VALUE_BDT, fullLevelCommission } from "@/lib/rules";
import { formatBdt } from "@/lib/money";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { useState, type ReactNode } from "react";
import {
  BadgeCheck,
  BookOpen,
  Check,
  ChevronDown,
  Landmark,
  Layers,
  Menu,
  Scale,
  Users,
  Wallet,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: Landing });

const NAV = [
  { href: "#how-it-works", label: "How It Works" },
  { href: "#land-benefit", label: "Land Benefit" },
  { href: "#levels", label: "Levels" },
  { href: "#faq", label: "FAQ" },
] as const;

const LAND_BENEFIT_POINTS = [
  "1 Katha land benefit after qualification",
  "1 Membership ID = ৳11,000",
  "Personally sponsor 3 members",
  "Successfully complete Level 9",
] as const;
