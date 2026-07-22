    // JavaScript 代码，计算并更新时间标签的内容
    const timeLabel = document.getElementById("timeLabel");
    // 时间计算多少错误
    // 提交时间（使用 "Asia/Shanghai" 时区）
    const submissionDate = new Date("2023-08-05T18:21:00"); // 假设是提交的时间

    // 当前时间（使用 "Asia/Shanghai" 时区）
    const currentDate = new Date();

    // 计算时间差（以毫秒为单位）
    const timeDifference = currentDate - submissionDate;

    // 计算时间差的各种单位
    const seconds = Math.floor(timeDifference / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30.44); // 平均每月的天数
    const years = Math.floor(days / 365);

    if (seconds < 60) {
        timeLabel.textContent = `${seconds} 秒前`;
    } else if (minutes < 60) {
        timeLabel.textContent = `${minutes} 分钟前`;
    } else if (hours < 24) {
        timeLabel.textContent = `${hours} 小时前`;
    } else if (days < 7) {
        timeLabel.textContent = `${days} 天前`;
    } else if(weeks<7){
        timeLabel.textContent = `${weeks} 周前`;
    }
    else if (months < 12) {
        timeLabel.textContent = `${months} 个月前`;
    } else if (years < 100) {
        timeLabel.textContent = `${years} 年前`;
    } else {
        timeLabel.textContent = `时间错误`;
    }