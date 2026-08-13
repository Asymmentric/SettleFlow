const main = async () => {
    const parrallelApiCalls = [
        fetch('http://localhost:3000/api/v1/orders/6a7b1c6e499978a73c8e4fe2/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNzg0YzAyZWUzNGUzOTE4ZTBkYzg5ZSIsImVtYWlsIjoiam9obkBlbWFpbC5jb20iLCJuYW1lIjoiVGVzdCBVc2VyIDEiLCJpYXQiOjE3ODY0MzU1NjEsImV4cCI6MTc4NzA0MDM2MX0.y-abbwPqISugUPdQ4Ywt98wQZGUm6Lc37ibfwauu6wE'
            },
            body: JSON.stringify({
                amount: 100,
                note: 'Payment 1 for order 6a7b1c6e499978a73c8e4fe2'
            })
        }),
        fetch('http://localhost:3000/api/v1/orders/6a7b1c6e499978a73c8e4fe2/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhNzg0YzAyZWUzNGUzOTE4ZTBkYzg5ZSIsImVtYWlsIjoiam9obkBlbWFpbC5jb20iLCJuYW1lIjoiVGVzdCBVc2VyIDEiLCJpYXQiOjE3ODY0MzU1NjEsImV4cCI6MTc4NzA0MDM2MX0.y-abbwPqISugUPdQ4Ywt98wQZGUm6Lc37ibfwauu6wE'
            },
            body: JSON.stringify({
                amount: 200,
                note: 'Payment 2 for order 6a7b1c6e499978a73c8e4fe2'
            })
        }),
    ]
    const [res1, res2] = await Promise.all(parrallelApiCalls);

    const data1 = await res1.json();
    const data2 = await res2.json();

    console.log('Response from Payment 1:', data1);
    console.log('Response from Payment 2:', data2);
}

main().then(() => {
    console.log('All API calls completed successfully.');
}).catch((error) => {
    console.error('Error occurred during API calls:', error);
});