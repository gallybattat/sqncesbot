# GitHub Pages Setup Instructions

Follow these step-by-step instructions to host the Sqnces Analysis Tool on GitHub Pages.

## Prerequisites
- A GitHub account
- Git installed on your computer
- This repository cloned locally

## Step-by-Step Instructions

### 1. Create a GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **+** icon in the top right and select **New repository**
3. Name your repository (e.g., `sqnces-solver` or `sqnces-analysis-tool`)
4. Make it **Public** (required for free GitHub Pages hosting)
5. Don't initialize with README, .gitignore, or license (since we already have files)
6. Click **Create repository**

### 2. Connect Your Local Repository to GitHub

In your terminal, navigate to the project folder and run:

```bash
# Add the GitHub repository as origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY_NAME.git

# Push your code to GitHub
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPOSITORY_NAME` with your actual GitHub username and repository name.

### 3. Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings** (in the repository navigation)
3. Scroll down to the **Pages** section in the left sidebar
4. Under **Source**, select:
   - **Deploy from a branch**
   - Branch: **main**
   - Folder: **/docs**
5. Click **Save**

### 4. Wait for Deployment

1. GitHub will take a few minutes to build and deploy your site
2. You can check the deployment status in the **Actions** tab
3. Once deployed, your site will be available at:
   ```
   https://YOUR_USERNAME.github.io/YOUR_REPOSITORY_NAME/
   ```

### 5. Verify Everything Works

1. Visit your GitHub Pages URL
2. Test the game functionality:
   - Try different word lengths (6, 7, 8)
   - Enter some test guesses
   - Check that the ranking updates properly
   - Verify the info modal opens

## File Structure

The `/docs` folder contains all the necessary files for GitHub Pages:
```
docs/
├── index.html          # Main HTML file
├── styles.css          # Styling
├── game.js             # Game logic
├── answers-6-index.json   # Word data files
├── answers-7-index.json
├── answers-8-index.json
├── guesses-6.json
├── guesses-7.json
├── guesses-8.json
└── README.md           # Documentation for the GitHub Pages site
```

## Updating the Site

To update your GitHub Pages site after making changes:

1. Make your changes to the files in the `/docs` folder
2. Commit and push the changes:
   ```bash
   git add docs/
   git commit -m "Update GitHub Pages site"
   git push
   ```
3. GitHub Pages will automatically redeploy within a few minutes

## Custom Domain (Optional)

If you have a custom domain:

1. Create a file named `CNAME` in the `/docs` folder
2. Add your domain name (e.g., `sqnces.yourdomain.com`)
3. Configure your domain's DNS settings to point to GitHub Pages
4. Update the custom domain in Repository Settings > Pages

## Troubleshooting

- **404 Error**: Make sure the repository is public and GitHub Pages is enabled
- **Files not loading**: Check that all file paths in the HTML are relative (no leading `/`)
- **JavaScript errors**: Open browser console (F12) to see error messages
- **Deployment failed**: Check the Actions tab for error messages

## Support

If you encounter issues:
1. Check the GitHub Pages documentation: https://docs.github.com/en/pages
2. Verify all files are in the `/docs` folder
3. Ensure the repository is public
4. Check browser console for JavaScript errors