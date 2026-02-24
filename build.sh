# node不存在或则版本小于22，则安装nodejs
if ! command -v node &> /dev/null || [ "$(node -v | cut -c 2-4)" -lt "22" ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt update
    apt install -y nodejs
else
    echo "nodejs already installed"
fi

# 安装python3.12，如果已经安装，则跳过
if ! command -v python3.12 &> /dev/null; then
    apt-get install -y python3.12
else
    echo "python3.12 already installed"
fi

# building
cd server
python3 -m venv venv
. venv/bin/activate
pip install -r requirements.txt

cd ../web
npm install
npm run build