# 🔍 **Hugging Face CLI Commands Explained**

## **Command Breakdown:**

### **1. Copy README** 📄
```bash
cp huggingface-space-README.md /path/to/your/space/README.md
```
**What it does:** Copies the optimized README file to your local Hugging Face Space directory
**Purpose:** Prepares the updated content for upload

### **2. Upload to Space** 📤
```bash
hf upload lablab-ai-amd-developer-hackathon/proofbridge-liner-safety-kernel \
  --repo-type space \
  --commit-message "feat: deploy AMD hackathon optimization + performance metrics"
```
**What it does:** Uploads all files from current directory to your Hugging Face Space
**Purpose:** Deploys the updated README and any other files to make them live

### **3. Set Hardware** ⚙️
```bash
hf spaces hardware-set lablab-ai-amd-developer-hackathon/proofbridge-liner-safety-kernel --hardware "amd-instinct-mi300x"
```
**What it does:** Configures the Space to run on AMD Instinct MI300X hardware
**Purpose:** Ensures your Space uses the correct hardware for the hackathon category

### **4. Check Logs** 📊
```bash
hf spaces logs lablab-ai-amd-developer-hackathon/proofbridge-liner-safety-kernel
```
**What it does:** Shows the deployment logs and status
**Purpose:** Verifies the deployment was successful and checks for any errors

## 🚨 **Important Notes:**

- **Run locally:** Execute these on your machine where `hf` CLI is installed
- **Directory:** Make sure you're in the directory containing `huggingface-space-README.md`
- **Authentication:** Ensure you're logged in with `hf login`
- **Space exists:** The space should already be created at the specified path

## 🔧 **Troubleshooting:**

**If upload fails:**
- Check if you're in the correct directory
- Verify `hf login` status
- Ensure space name is exact

**If hardware setting fails:**
- Space might need to be restarted after hardware change
- Check available hardware options with `hf spaces hardware-types`

**If logs show errors:**
- Check README.md formatting (YAML frontmatter)
- Verify file paths and permissions

## ✅ **Expected Outcome:**
- Space updates with new README showing performance metrics
- Hardware shows as "AMD Instinct MI300X" 
- Build completes successfully
- Space is live with hackathon-optimized content

**Ready to run these commands locally? Let me know the results!** 🚀