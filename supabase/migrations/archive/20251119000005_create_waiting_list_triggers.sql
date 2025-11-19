-- Create function to auto-add tenant to waiting list on signup
CREATE OR REPLACE FUNCTION add_to_waiting_list_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Only add to waiting list if:
  -- 1. Tenant has a website_url
  -- 2. Inventory status is 'pending'
  -- 3. Not already in waiting list
  IF NEW.website_url IS NOT NULL
     AND NEW.inventory_status = 'pending'
     AND NOT EXISTS (
       SELECT 1 FROM public.scraping_waiting_list
       WHERE tenant_id = NEW.id
     ) THEN
    INSERT INTO public.scraping_waiting_list (tenant_id, website_url, requested_at)
    VALUES (NEW.id, NEW.website_url, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new tenant signups
DROP TRIGGER IF EXISTS trigger_add_to_waiting_list_on_signup ON public.tenants;
CREATE TRIGGER trigger_add_to_waiting_list_on_signup
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION add_to_waiting_list_on_signup();

-- Create function to log when added to waiting list
CREATE OR REPLACE FUNCTION notify_vas_on_waiting_list_add()
RETURNS TRIGGER AS $$
BEGIN
  -- Note: The actual Slack notification will be sent by the Edge Function
  -- This trigger is just a placeholder for logging/future enhancements
  -- The Edge Function will poll for entries where notified_at is NULL
  -- and send notifications asynchronously

  -- Don't set notified_at here - let the Edge Function do that after successful notification

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for waiting list notifications
DROP TRIGGER IF EXISTS trigger_notify_vas_on_waiting_list ON public.scraping_waiting_list;
CREATE TRIGGER trigger_notify_vas_on_waiting_list
  AFTER INSERT ON public.scraping_waiting_list
  FOR EACH ROW
  EXECUTE FUNCTION notify_vas_on_waiting_list_add();

-- Create function to remove from waiting list when inventory is ready
CREATE OR REPLACE FUNCTION remove_from_waiting_list_when_ready()
RETURNS TRIGGER AS $$
BEGIN
  -- If inventory status changed to 'ready', mark waiting list entry as completed
  IF NEW.inventory_status = 'ready' AND OLD.inventory_status != 'ready' THEN
    UPDATE public.scraping_waiting_list
    SET
      status = 'completed',
      completed_at = NOW()
    WHERE tenant_id = NEW.id
      AND status != 'completed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for completing waiting list when inventory is ready
DROP TRIGGER IF EXISTS trigger_complete_waiting_list_on_ready ON public.tenants;
CREATE TRIGGER trigger_complete_waiting_list_on_ready
  AFTER UPDATE ON public.tenants
  FOR EACH ROW
  WHEN (NEW.inventory_status = 'ready')
  EXECUTE FUNCTION remove_from_waiting_list_when_ready();

-- Add comments for documentation
COMMENT ON FUNCTION add_to_waiting_list_on_signup() IS 'Automatically adds new tenants with website URLs to the scraping waiting list';
COMMENT ON FUNCTION notify_vas_on_waiting_list_add() IS 'Marks waiting list entries for VA notification (actual notification sent by Edge Function)';
COMMENT ON FUNCTION remove_from_waiting_list_when_ready() IS 'Marks waiting list entry as completed when tenant inventory becomes ready';
