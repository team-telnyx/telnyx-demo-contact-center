import 'dotenv/config';
import express from '#lib/router-shim';
import axios from 'axios';

const router = express.Router();

// Helper to build Telnyx headers
const getTelnyxHeaders = () => ({
  'Authorization': `Bearer ${process.env.TELNYX_API}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
});

// GET /available-numbers
router.get('/available-numbers', async (req, res) => {
  try {
    const { country_code = 'US', locality, administrative_area, area_code, limit = 10 } = req.query;

    console.log('🔍 Searching for phone numbers:', { country_code, locality, administrative_area, area_code });

    const params = {
      'filter[country_code]': country_code,
      'filter[limit]': limit,
      'filter[features]': 'voice,sms' // Ensure numbers support voice and SMS
    };

    if (locality) params['filter[locality]'] = locality;
    if (administrative_area) params['filter[administrative_area]'] = administrative_area;
    if (area_code) params['filter[national_destination_code]'] = area_code;

    const response = await axios.get('https://api.telnyx.com/v2/available_phone_numbers', {
      headers: getTelnyxHeaders(),
      params
    });

    res.json(response.data);
  } catch (error) {
    console.error('❌ Error searching phone numbers:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to search phone numbers',
      details: error.response?.data || error.message
    });
  }
});

// POST /purchase-number
router.post('/purchase-number', async (req, res) => {
  try {
    const { phoneNumber, connectionId, username } = req.body;

    if (!phoneNumber || !connectionId || !username) {
      return res.status(400).json({ error: 'Missing required fields: phoneNumber, connectionId, username' });
    }

    console.log('🛒 Purchasing phone number:', { phoneNumber, connectionId, username });

    const orderPayload = {
      phone_numbers: [
        {
          phone_number: phoneNumber,
          connection_id: connectionId,
          tags: [username]
        }
      ]
    };

    const response = await axios.post('https://api.telnyx.com/v2/number_orders', orderPayload, {
      headers: getTelnyxHeaders()
    });

    console.log('✅ Number order created:', response.data);

    // Wait 2 seconds to allow Telnyx to process the order
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Fetch the number ID to update it
    console.log('🔍 Fetching number ID for update:', phoneNumber);
    const searchResponse = await axios.get('https://api.telnyx.com/v2/phone_numbers', {
      headers: getTelnyxHeaders(),
      params: {
        'filter[phone_number]': phoneNumber
      }
    });

    const numbers = searchResponse.data.data;
    if (numbers && numbers.length > 0) {
      const numberId = numbers[0].id;
      console.log('✅ Found number ID:', numberId);

      // Step 3: Update the number with connection_id and tags
      console.log('📝 Updating number settings...');
      await axios.patch(`https://api.telnyx.com/v2/phone_numbers/${numberId}`, {
        connection_id: connectionId,
        tags: [username]
      }, {
        headers: getTelnyxHeaders()
      });
      console.log('✅ Number settings updated successfully');
    } else {
      console.warn('⚠️ Could not find purchased number to update settings. It may take a moment to appear in inventory.');
    }

    res.status(201).json({
      message: 'Phone number purchased and configured successfully',
      data: response.data
    });

  } catch (error) {
    console.error('❌ Error purchasing phone number:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      error: 'Failed to purchase phone number',
      details: error.response?.data || error.message
    });
  }
});

export default router;
