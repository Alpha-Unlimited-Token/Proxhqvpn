// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { lazy } from "react";
import { Route } from "wouter";
import { PublicLayout, ProtectedLayout, CcLayout } from "./routeGuards";
import { AppLanding } from "./AppLanding";
import { SignInPage, SignUpPage } from "./authScreens";

import Home from "@/pages/Home";
import Pricing from "@/pages/Pricing";
import Account from "@/pages/Account";
import AutoSetup from "@/pages/AutoSetup";
import Ambassadors from "@/pages/Ambassadors";
import AmbassadorApply from "@/pages/AmbassadorApply";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import AnonAuth from "@/pages/AnonAuth";
import AnonDashboard from "@/pages/AnonDashboard";
import AnonUpgrade from "@/pages/AnonUpgrade";
import HackAnon from "@/pages/HackAnon";
import AmbassadorHandbook from "@/pages/AmbassadorHandbook";
import EmployeeHandbook from "@/pages/EmployeeHandbook";
import ImAutomation from "@/pages/ImAutomation";
import RedTeamScan from "@/pages/RedTeamScan";

const Downloads        = lazy(() => import("@/pages/Downloads"));
const BrowserExtension = lazy(() => import("@/pages/BrowserExtension"));
const UserGuide        = lazy(() => import("@/pages/UserGuide"));
const ParrotTools      = lazy(() => import("@/pages/ParrotTools"));

function HomeRedirect() {
  return <Home />;
}

export function PublicRoutes() {
  return (
    <>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />

      <Route path="/anon-auth" component={AnonAuth} />
      <Route path="/anon" component={AnonDashboard} />
      <Route path="/anon/upgrade" component={AnonUpgrade} />

      <Route path="/app">
        <ProtectedLayout><AppLanding /></ProtectedLayout>
      </Route>

      <Route path="/pricing">
        <PublicLayout><Pricing /></PublicLayout>
      </Route>

      <Route path="/downloads">
        <PublicLayout><Downloads /></PublicLayout>
      </Route>

      <Route path="/browser-extension">
        <PublicLayout><BrowserExtension /></PublicLayout>
      </Route>

      <Route path="/guide">
        <PublicLayout><UserGuide /></PublicLayout>
      </Route>

      <Route path="/parrot-tools">
        <CcLayout><ParrotTools /></CcLayout>
      </Route>

      <Route path="/im-auto">
        <CcLayout><ImAutomation /></CcLayout>
      </Route>

      <Route path="/redteam-scan">
        <CcLayout><RedTeamScan /></CcLayout>
      </Route>

      <Route path="/hackanon">
        <CcLayout><HackAnon /></CcLayout>
      </Route>

      <Route path="/handbook/ambassador">
        <PublicLayout><AmbassadorHandbook /></PublicLayout>
      </Route>

      <Route path="/handbook/employee">
        <ProtectedLayout><EmployeeHandbook /></ProtectedLayout>
      </Route>

      <Route path="/account">
        <ProtectedLayout><Account /></ProtectedLayout>
      </Route>

      <Route path="/ambassadors">
        <PublicLayout><Ambassadors /></PublicLayout>
      </Route>

      <Route path="/ambassador/apply">
        <ProtectedLayout><AmbassadorApply /></ProtectedLayout>
      </Route>

      <Route path="/checkout/success">
        <ProtectedLayout><CheckoutSuccess /></ProtectedLayout>
      </Route>

      <Route path="/autosetup">
        <AutoSetup />
      </Route>
    </>
  );
}
