import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Link as RouterLink } from "react-router-dom";

interface TroubleshootingIssue {
  id: string;
  title: string;
  symptom: string;
  likelyCause: string;
  tags: string[];
  steps: string[];
  quickLinks?: Array<{ to: string; label: string }>;
}

const ISSUES: TroubleshootingIssue[] = [
  {
    id: "token-expired",
    title: "Token expired or OAuth disconnected",
    symptom: "Source status shows warning/disconnected, or API calls fail with authorization errors.",
    likelyCause: "Strava or related OAuth token is expired, revoked, or not configured.",
    tags: ["Tokens", "OAuth"],
    steps: [
      "Open Sources and confirm Strava client configuration is present.",
      "Run Strava reconnect flow (OAuth) and verify status becomes connected.",
      "Retry the failed action from Control or Build after token refresh."
    ],
    quickLinks: [
      { to: "/sources", label: "Open Sources" },
      { to: "/control", label: "Open Control" }
    ]
  },
  {
    id: "docker-runtime",
    title: "Docker or worker runtime not running",
    symptom: "Health page reports worker heartbeat unhealthy or payload not updating.",
    likelyCause: "Docker containers or worker process stopped, failed startup, or crashed.",
    tags: ["Docker", "Runtime"],
    steps: [
      "Check container status with `docker compose ps`.",
      "Start/restart services with `docker compose up -d`.",
      "Verify worker heartbeat and readiness on the Health page, then retry the operation."
    ],
    quickLinks: [{ to: "/status", label: "Open Health" }]
  },
  {
    id: "network-connectivity",
    title: "Connectivity or API availability issue",
    symptom: "Health checks are partially unavailable or API requests time out/fail repeatedly.",
    likelyCause: "Local network/Tailscale interruption or temporary third-party API outage.",
    tags: ["Connectivity", "API"],
    steps: [
      "Verify local network and Tailscale connectivity before retrying requests.",
      "Use Health page warnings to identify which endpoint is unavailable.",
      "Retry after a short backoff window; if persistent, review logs for endpoint-specific failures."
    ],
    quickLinks: [{ to: "/status", label: "Open Health" }]
  }
];

export function TroubleshootingPage() {
  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="h4">Troubleshooting</Typography>
        <Typography variant="body2" color="text.secondary">
          Resolve common issues with direct, actionable fixes.
        </Typography>
      </Box>

      {ISSUES.map((issue) => (
        <Card key={issue.id} variant="outlined" data-testid={`troubleshooting-issue-${issue.id}`}>
          <CardContent sx={{ display: "grid", gap: 1.25 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between" }}>
              <Typography variant="subtitle1">{issue.title}</Typography>
              <Stack direction="row" spacing={0.5}>
                {issue.tags.map((tag) => (
                  <Chip key={tag} size="small" variant="outlined" label={tag} />
                ))}
              </Stack>
            </Stack>

            <Typography variant="body2">
              <strong>Symptom:</strong> {issue.symptom}
            </Typography>
            <Typography variant="body2">
              <strong>Likely cause:</strong> {issue.likelyCause}
            </Typography>

            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Resolution steps
              </Typography>
              <Box component="ol" sx={{ pl: 2.5, m: 0 }}>
                {issue.steps.map((step) => (
                  <Typography component="li" variant="body2" key={step} sx={{ mb: 0.25 }}>
                    {step}
                  </Typography>
                ))}
              </Box>
            </Box>

            {issue.quickLinks && issue.quickLinks.length > 0 ? (
              <Stack direction="row" spacing={1} sx={{ mt: 0.5, flexWrap: "wrap" }}>
                {issue.quickLinks.map((link) => (
                  <Button
                    key={`${issue.id}-${link.to}`}
                    size="small"
                    variant="text"
                    component={RouterLink}
                    to={link.to}
                  >
                    {link.label}
                  </Button>
                ))}
              </Stack>
            ) : null}
          </CardContent>
        </Card>
      ))}

      <Typography variant="caption" color="text.secondary">
        Need broader context? Review <Link component={RouterLink} to="/status">Health status</Link> before escalating.
      </Typography>
    </Box>
  );
}
