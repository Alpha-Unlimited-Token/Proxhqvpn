#!/usr/bin/env bash
set -euo pipefail
PROFILE=${PROFILE:-xccdf_org.ssgproject.content_profile_stig}
CONTENT=${CONTENT:-/usr/share/xml/scap/ssg/content/ssg-ubuntu2204-ds.xml}
oscap xccdf eval --profile "$PROFILE" --results /var/log/proxhqvpn/openscap-results.xml --report /var/log/proxhqvpn/openscap-report.html "$CONTENT"
