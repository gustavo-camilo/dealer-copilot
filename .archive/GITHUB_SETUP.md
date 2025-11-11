# GitHub Setup Guide

## Exporting This Repository to GitHub

Follow these steps to push this project to your GitHub account:

### 1. Create a New GitHub Repository

1. Go to https://github.com/new
2. Repository name: `dealer-copilot` (or your preferred name)
3. Description: "Mobile-first acquisition intelligence platform for automotive dealers"
4. Choose Private or Public
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### 2. Push to GitHub

Your repository is already initialized with git. Run these commands:

```bash
# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/dealer-copilot.git

# Push your code to GitHub
git push -u origin master
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### 3. Verify Upload

1. Go to your GitHub repository URL
2. You should see all files and the commit history
3. The README.md will display on the repository homepage

## Repository Structure

```
dealer-copilot/
├── src/
│   ├── components/       # Reusable UI components (to be added)
│   ├── contexts/         # React Context providers
│   ├── hooks/            # Custom React hooks (to be added)
│   ├── lib/              # Utilities and helpers
│   ├── pages/            # Page components
│   ├── services/         # API services (to be added)
│   └── types/            # TypeScript type definitions
├── supabase/
│   └── migrations/       # Database migration files
├── public/               # Static assets
├── .env                  # Environment variables (NOT committed)
├── README.md             # Project documentation
├── DEPLOYMENT.md         # Deployment instructions
└── package.json          # Dependencies and scripts
```

## Protecting Sensitive Files

The `.env` file is already in `.gitignore` and will NOT be pushed to GitHub. This is correct - never commit environment variables to version control.

## Branching Strategy (Optional)

For production projects, consider this branching model:

```bash
# Create development branch
git checkout -b develop

# Create feature branches from develop
git checkout -b feature/sweet-spot-analysis

# Merge back to develop when done
git checkout develop
git merge feature/sweet-spot-analysis

# Merge to master for production releases
git checkout master
git merge develop
```

## Collaborating with Team

### Adding Collaborators

1. Go to repository Settings
2. Click "Collaborators and teams"
3. Add team members by GitHub username

### Pull Request Workflow

1. Create a feature branch
2. Make changes and commit
3. Push branch to GitHub
4. Open a Pull Request
5. Review and merge

## GitHub Actions (Optional)

Consider setting up GitHub Actions for:
- Automated testing
- Build verification
- Deployment to staging/production

Example `.github/workflows/build.yml`:

```yaml
name: Build and Test

on:
  push:
    branches: [ master, develop ]
  pull_request:
    branches: [ master, develop ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npm run lint
```

## Next Steps

1. Push code to GitHub using commands above
2. Set up branch protection rules (Settings → Branches)
3. Enable GitHub Issues for task tracking
4. Set up Projects for sprint planning
5. Configure GitHub Pages for documentation (optional)

## Troubleshooting

**Error: remote origin already exists**
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/dealer-copilot.git
```

**Error: failed to push some refs**
```bash
git pull origin master --rebase
git push -u origin master
```

**Authentication Error**
- Use personal access token instead of password
- Or set up SSH keys (https://docs.github.com/en/authentication)

## Resources

- [GitHub Docs](https://docs.github.com)
- [Git Basics](https://git-scm.com/book/en/v2/Getting-Started-Git-Basics)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
