import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { sendEmergencyAlert } from '../utils/emailAlert.js';

dotenv.config();

const router = express.Router();

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Middleware to verify user authentication
 */
const verifyAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = data.user;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({ error: 'Authentication verification failed' });
  }
};

/**
 * POST /api/emergency-contact
 * Create a new emergency contact for the user
 */
router.post('/', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { contact_name, contact_email, contact_phone, preferred_method, notify_enabled } = req.body;

    // Validation
    if (!contact_name || !contact_email) {
      return res.status(400).json({
        error: 'Contact name and email are required',
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      return res.status(400).json({
        error: 'Invalid email address',
      });
    }

    // Phone validation (if provided)
    if (contact_phone && !/^[\d\s+\-()]{10,}$/.test(contact_phone)) {
      return res.status(400).json({
        error: 'Invalid phone number format',
      });
    }

    // Check if emergency contact already exists for this user
    const { data: existingContact } = await supabase
      .from('emergency_contacts')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (existingContact) {
      return res.status(409).json({
        error: 'Emergency contact already exists for this user. Use PUT to update.',
      });
    }

    // Insert new emergency contact
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({
        user_id: userId,
        contact_name,
        contact_email,
        contact_phone: contact_phone || null,
        preferred_method: preferred_method || 'email',
        notify_enabled: notify_enabled !== false,
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        error: 'Failed to create emergency contact',
      });
    }

    res.status(201).json({
      success: true,
      message: 'Emergency contact created successfully',
      contact: data,
    });
  } catch (error) {
    console.error('Error in POST /api/emergency-contact:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/emergency-contact/:userId
 * Retrieve emergency contact for a specific user
 */
router.get('/:userId', verifyAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Ensure user can only access their own contact
    if (req.user.id !== userId) {
      return res.status(403).json({
        error: 'You do not have permission to access this contact',
      });
    }

    const { data, error } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Not found
      return res.status(404).json({
        error: 'Emergency contact not found',
        contact: null,
      });
    }

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        error: 'Failed to retrieve emergency contact',
      });
    }

    res.status(200).json({
      success: true,
      contact: data,
    });
  } catch (error) {
    console.error('Error in GET /api/emergency-contact/:userId:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * PUT /api/emergency-contact/:userId
 * Update emergency contact information
 */
router.put('/:userId', verifyAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { contact_name, contact_email, contact_phone, preferred_method, notify_enabled } = req.body;

    // Ensure user can only update their own contact
    if (req.user.id !== userId) {
      return res.status(403).json({
        error: 'You do not have permission to update this contact',
      });
    }

    // Validation
    if (contact_name && typeof contact_name !== 'string') {
      return res.status(400).json({
        error: 'Contact name must be a string',
      });
    }

    if (contact_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact_email)) {
        return res.status(400).json({
          error: 'Invalid email address',
        });
      }
    }

    if (contact_phone && !/^[\d\s+\-()]{10,}$/.test(contact_phone)) {
      return res.status(400).json({
        error: 'Invalid phone number format',
      });
    }

    // Build update object (only include provided fields)
    const updateData = {};
    if (contact_name) updateData.contact_name = contact_name;
    if (contact_email) updateData.contact_email = contact_email;
    if (contact_phone !== undefined) updateData.contact_phone = contact_phone || null;
    if (preferred_method) updateData.preferred_method = preferred_method;
    if (notify_enabled !== undefined) updateData.notify_enabled = notify_enabled;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No fields to update',
      });
    }

    const { data, error } = await supabase
      .from('emergency_contacts')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error && error.code === 'PGRST116') {
      return res.status(404).json({
        error: 'Emergency contact not found',
      });
    }

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        error: 'Failed to update emergency contact',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Emergency contact updated successfully',
      contact: data,
    });
  } catch (error) {
    console.error('Error in PUT /api/emergency-contact/:userId:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * DELETE /api/emergency-contact/:userId
 * Delete emergency contact
 */
router.delete('/:userId', verifyAuth, async (req, res) => {
  try {
    const { userId } = req.params;

    // Ensure user can only delete their own contact
    if (req.user.id !== userId) {
      return res.status(403).json({
        error: 'You do not have permission to delete this contact',
      });
    }

    const { error } = await supabase
      .from('emergency_contacts')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        error: 'Failed to delete emergency contact',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Emergency contact deleted successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/emergency-contact/:userId:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/emergency-contact/trigger-alert/:userId
 * Manually trigger an emergency alert (for testing or when high-risk emotion detected)
 * This should only be called from internal services or authorized endpoints
 */
router.post('/trigger-alert/:userId', verifyAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { emotion, timestamp } = req.body;

    // Ensure user can only trigger alerts for themselves
    if (req.user.id !== userId) {
      return res.status(403).json({
        error: 'You do not have permission to trigger alerts for this user',
      });
    }

    if (!emotion) {
      return res.status(400).json({
        error: 'Emotion is required to trigger alert',
      });
    }

    // Fetch user details
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    if (userError || !userData.user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    // Fetch emergency contact
    const { data: contact, error: contactError } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (contactError || !contact) {
      return res.status(404).json({
        error: 'Emergency contact not found',
      });
    }

    // Check if notifications are enabled
    if (!contact.notify_enabled) {
      return res.status(400).json({
        error: 'Emergency notifications are disabled for this contact',
      });
    }

    // Send alert
    const user = {
      id: userData.user.id,
      full_name: userData.user.user_metadata?.full_name || userData.user.email,
      email: userData.user.email,
    };

    const alertSent = await sendEmergencyAlert(
      user,
      contact,
      emotion,
      timestamp || new Date()
    );

    if (!alertSent) {
      return res.status(500).json({
        error: 'Failed to send emergency alert',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Emergency alert sent successfully',
      contactEmail: contact.contact_email,
    });
  } catch (error) {
    console.error('Error in POST /api/emergency-contact/trigger-alert:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export default router;
